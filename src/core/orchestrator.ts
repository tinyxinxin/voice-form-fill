import type { FieldMeta, FillResult } from './types'
import type { LLMAdapter } from '../llm/types'
import { extractFormStructure } from './extractor'
import { fillFormByMapping } from './filler'
import { debug } from './logger'

export interface OrchestratorOptions {
  llmAdapter: LLMAdapter
  apiKey: string
  baseUrl?: string
  model?: string
  signal?: AbortSignal
}

/**
 * 完整流程：提取表单 → 调 LLM → 回填
 */
export async function processVoiceFill(
  userText: string,
  childrenList: Record<string, any>[],
  options: OrchestratorOptions
): Promise<FillResult> {
  const t0 = performance.now()

  const fields = extractFormStructure(childrenList)
  debug('Extracted', fields.length, 'form fields from', childrenList.length, 'children')
  if (fields.length === 0) {
    throw new Error('No fillable fields found in form data')
  }

  const meta: FieldMeta[] = fields.map(({ label, type, options: opts }) => ({
    label,
    type,
    options: opts?.length ? opts : undefined,
  }))

  debug('Calling LLM adapter:', options.llmAdapter.name, 'model:', options.model ?? options.llmAdapter.defaultModel)
  const t1 = performance.now()

  const mapping = await options.llmAdapter.call({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? options.llmAdapter.defaultBaseUrl,
    model: options.model ?? options.llmAdapter.defaultModel,
    formStructure: meta,
    userText,
    signal: options.signal,
  })

  debug('LLM response mapping:', mapping, `(${((performance.now() - t1) / 1000).toFixed(2)}s)`)

  const result = fillFormByMapping(mapping, fields)
  debug('Fill result:', result, `(total: ${((performance.now() - t0) / 1000).toFixed(2)}s)`)
  return result
}
