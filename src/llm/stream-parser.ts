import type { StreamCallbacks } from './types'

/** 在 JSON 字符串中查找匹配的左括号对应的闭合括号 */
function findMatchingBracket(str: string, startIndex: number): number {
  const open = str[startIndex]
  const close = open === '[' ? ']' : '}'
  let depth = 1
  let i = startIndex + 1
  let inString = false

  while (i < str.length && depth > 0) {
    const ch = str[i]
    if (ch === '\\' && inString) {
      i += 2
      continue
    }
    if (ch === '"') {
      inString = !inString
    } else if (!inString) {
      if (ch === open) depth++
      else if (ch === close) depth--
    }
    i++
  }

  return depth === 0 ? i - 1 : -1
}

/** 从流式累积 JSON 中以字符串形式提取已完整的键值对 */
function findCompletePairs(
  buffer: string,
  startIndex: number
): { pairs: Array<{ key: string; value: unknown }>; nextIndex: number } {
  const pairs: Array<{ key: string; value: unknown }> = []
  let i = startIndex

  while (i < buffer.length) {
    const rest = buffer.slice(i)

    const keyStartMatch = rest.match(/"([^"]*)"\s*:\s*/)
    if (!keyStartMatch || keyStartMatch.index == null) break

    i += keyStartMatch.index
    const key = keyStartMatch[1]
    const valueStart = i + keyStartMatch[0].length

    if (buffer[valueStart] === '"') {
      const valueMatch = buffer.slice(valueStart).match(/^"([^"]*)"\s*([,\}])/)
      if (!valueMatch) break
      pairs.push({ key, value: valueMatch[1] })
      i = valueStart + valueMatch[0].length
    } else if (buffer[valueStart] === '[' || buffer[valueStart] === '{') {
      const closeIdx = findMatchingBracket(buffer, valueStart)
      if (closeIdx === -1) break

      let nextIdx = closeIdx + 1
      while (nextIdx < buffer.length && buffer[nextIdx] === ' ') nextIdx++
      if (
        nextIdx >= buffer.length ||
        (buffer[nextIdx] !== ',' && buffer[nextIdx] !== '}')
      )
        break

      const jsonStr = buffer.slice(valueStart, closeIdx + 1)
      let value: unknown
      try {
        value = JSON.parse(jsonStr)
      } catch {
        value = jsonStr
      }
      pairs.push({ key, value })
      i = nextIdx + 1
    } else {
      const valueMatch = buffer
        .slice(valueStart)
        .match(/^([^\s,\}]+)\s*([,\}])/)
      if (!valueMatch) break
      let value: unknown
      const raw = valueMatch[1]
      if (raw === 'null') value = null
      else if (raw === 'true') value = true
      else if (raw === 'false') value = false
      else {
        const n = Number(raw)
        value = isNaN(n) ? raw : n
      }
      pairs.push({ key, value })
      i = valueStart + valueMatch[0].length
    }
  }

  return { pairs, nextIndex: i }
}

/**
 * 流式 JSON 增量解析器
 *
 * 随着 LLM 流式输出 token，尝试逐步解析 JSON 对象，
 * 当检测到新的 key-value 对时触发 onField 回调。
 */
export class StreamJsonParser {
  private callbacks: StreamCallbacks
  private buffer = ''
  private parsed: Set<string> = new Set()
  private finished = false

  constructor(callbacks: StreamCallbacks) {
    this.callbacks = callbacks
  }

  /** 喂入新的文本片段 */
  feed(chunk: string): void {
    if (this.finished) return

    this.buffer += chunk

    try {
      const { pairs } = findCompletePairs(this.buffer, 0)

      for (const { key, value } of pairs) {
        if (this.parsed.has(key)) continue
        this.parsed.add(key)

        if (value == null || value === '') continue

        this.callbacks.onField?.(key, value)
      }
    } catch {
      // 增量解析失败时静默，等待更多数据后再试
    }
  }

  /** 标记流结束，返回最终解析结果 */
  finalize(): Record<string, unknown> {
    this.finished = true

    try {
      const full = JSON.parse(this.buffer)
      if (typeof full === 'object' && full !== null) {
        const mapping = full as Record<string, unknown>
        this.callbacks.onComplete?.(mapping)
        return mapping
      }
    } catch {
      // Fallback: try to extract JSON from code blocks
    }

    try {
      const codeMatch = this.buffer.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeMatch) {
        const mapping = JSON.parse(codeMatch[1])
        this.callbacks.onComplete?.(mapping)
        return mapping
      }
    } catch {
      // Continue to regex extraction
    }

    try {
      const jsonMatch = this.buffer.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const mapping = JSON.parse(jsonMatch[0])
        this.callbacks.onComplete?.(mapping)
        return mapping
      }
    } catch {
      // All parsing failed
    }

    this.callbacks.onError?.(new Error('Could not parse JSON from stream'))
    return {}
  }
}

/**
 * 解析 SSE (Server-Sent Events) 流
 *
 * 从 fetch ReadableStream 中读取 data: 行并提取 delta.content，
 * 喂入 StreamJsonParser 进行增量解析。
 */
export async function parseSSEStream(
  response: Response,
  callbacks: StreamCallbacks
): Promise<Record<string, unknown>> {
  const parser = new StreamJsonParser(callbacks)
  const reader = response.body?.getReader()

  if (!reader) {
    callbacks.onError?.(new Error('Response body is not readable'))
    return {}
  }

  const decoder = new TextDecoder()
  let sseBuffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      sseBuffer += decoder.decode(value, { stream: true })
      const lines = sseBuffer.split('\n')
      sseBuffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const dataStr = trimmed.slice(6)
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            callbacks.onToken?.(delta)
            parser.feed(delta)
          }
        } catch {
          // 跳过无法解析的 SSE 行
        }
      }
    }

    // 处理剩余 SSE 缓冲区
    if (sseBuffer.trim()) {
      const trimmed = sseBuffer.trim()
      if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
        try {
          const parsed = JSON.parse(trimmed.slice(6))
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            callbacks.onToken?.(delta)
            parser.feed(delta)
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    callbacks.onError?.(
      err instanceof Error ? err : new Error(String(err))
    )
  }

  return parser.finalize()
}
