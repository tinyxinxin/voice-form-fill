import type { LLMAdapter, LLMCallOptions } from './types'
import { buildPrompt, parseJsonFromLLMResponse } from './types'
import { debug } from '../core/logger'

export class DeepSeekAdapter implements LLMAdapter {
  readonly name = 'deepseek'
  readonly defaultBaseUrl = 'https://api.deepseek.com/v1'
  readonly defaultModel = 'deepseek-chat'

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

    debug('DeepSeek API call:', url, 'model:', body.model)
    const t0 = performance.now()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(
        `DeepSeek API error (${response.status}): ${response.statusText}${errorText ? ' - ' + errorText : ''}`
      )
    }

    const data = await response.json()
    debug('DeepSeek API response:', `(${((performance.now() - t0) / 1000).toFixed(2)}s)`)
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek API returned empty response')

    return parseJsonFromLLMResponse(content)
  }
}
