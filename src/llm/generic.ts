import type { LLMAdapter, LLMCallOptions } from './types'
import { buildPrompt, parseJsonFromLLMResponse } from './types'

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

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model ?? this.defaultModel,
        messages: [
          {
            role: 'user',
            content: buildPrompt(formStructure, userText),
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `LLM API error (${response.status}): ${response.statusText}${errorText ? ' - ' + errorText : ''}`
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM API returned empty response')

    return parseJsonFromLLMResponse(content)
  }
}
