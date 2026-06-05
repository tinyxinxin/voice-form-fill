import type { LLMAdapter, LLMCallOptions } from './types'
import { buildPrompt, parseJsonFromLLMResponse } from './types'

export class OpenAIAdapter implements LLMAdapter {
  readonly name = 'openai'
  readonly defaultBaseUrl = 'https://api.openai.com/v1'
  readonly defaultModel = 'gpt-4o'

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

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
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
        `OpenAI API error (${response.status}): ${response.statusText}${errorText ? ' - ' + errorText : ''}`
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenAI API returned empty response')

    return parseJsonFromLLMResponse(content)
  }
}
