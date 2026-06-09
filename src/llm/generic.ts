import type { LLMAdapter, LLMCallOptions, StreamCallbacks } from './types'
import { buildPrompt, parseJsonFromLLMResponse } from './types'
import { parseSSEStream } from './stream-parser'
import { debug } from '../core/logger'

/**
 * 通用 OpenAI-compatible 适配器
 * 适用于：Ollama、vLLM、LocalAI、Together AI 等任何兼容 OpenAI 接口的服务
 */
export class GenericLLMAdapter implements LLMAdapter {
  readonly name = 'generic'
  readonly defaultBaseUrl = 'http://localhost:11434/v1'
  readonly defaultModel = 'llama3'

  async call(options: LLMCallOptions): Promise<Record<string, unknown>> {
    const {
      apiKey,
      baseUrl,
      model,
      formStructure,
      userText,
      signal,
      temperature = 0.1,
      maxTokens = 2000,
    } = options

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // 如果提供了 apiKey，添加认证头（本地模型如 Ollama 不需要）
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const url = `${baseUrl}/chat/completions`
    const body = {
      model: model ?? this.defaultModel,
      messages: [
        {
          role: 'user',
          content: buildPrompt(formStructure, userText),
        },
      ],
      temperature,
      max_tokens: maxTokens,
    }

    debug('Generic LLM API call:', url, 'model:', body.model)
    const t0 = performance.now()

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `LLM API error (${response.status}): ${response.statusText}${errorText ? ' - ' + errorText : ''}`
      )
    }

    const data = await response.json()
    debug('Generic LLM API response:', `(${((performance.now() - t0) / 1000).toFixed(2)}s)`)
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM API returned empty response')

    return parseJsonFromLLMResponse(content)
  }

  async callStream(
    options: LLMCallOptions,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const {
      apiKey,
      baseUrl,
      model,
      formStructure,
      userText,
      signal,
      temperature = 0.1,
      maxTokens = 2000,
    } = options

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const url = `${baseUrl}/chat/completions`
    const body = {
      model: model ?? this.defaultModel,
      messages: [
        {
          role: 'user',
          content: buildPrompt(formStructure, userText),
        },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }

    debug('Generic LLM API stream call:', url, 'model:', body.model)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `LLM API error (${response.status}): ${response.statusText}${errorText ? ' - ' + errorText : ''}`
      )
    }

    await parseSSEStream(response, callbacks)
  }
}
