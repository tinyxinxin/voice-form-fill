import type { FieldMeta } from '../core/types'

export interface LLMCallOptions {
  apiKey: string
  baseUrl: string
  model: string
  formStructure: FieldMeta[]
  userText: string
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
}

export interface LLMAdapter {
  readonly name: string
  readonly defaultBaseUrl: string
  readonly defaultModel: string
  call(options: LLMCallOptions): Promise<Record<string, unknown>>
}

/**
 * 构建发给大模型的 prompt
 */
export function buildPrompt(
  formStructure: FieldMeta[],
  userText: string
): string {
  return [
    '## Form Fields',
    JSON.stringify(formStructure, null, 2),
    '',
    '## User Input',
    userText,
    '',
    'Extract information from the user input that matches the above form fields.',
    'Return ONLY a JSON object where keys are the "label" values from form fields and values are the extracted information.',
    'For select/checkbox fields, use the exact option text.',
    'Return empty JSON object if nothing matches.',
  ].join('\n')
}

/**
 * 从 LLM 返回内容中解析 JSON
 */
export function parseJsonFromLLMResponse(
  content: string
): Record<string, unknown> {
  // 尝试直接解析
  try {
    return JSON.parse(content)
  } catch {
    // 尝试从 markdown code block 中提取
    const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeMatch) {
      return JSON.parse(codeMatch[1])
    }
    // 尝试提取 JSON 对象
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error(`Could not parse JSON from response:\n${content}`)
  }
}
