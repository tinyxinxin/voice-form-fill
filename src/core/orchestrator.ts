import type { FieldMeta, FillResult } from './types'
import type { LLMAdapter } from '../llm/types'
import { extractFormStructure } from './extractor'
import { fillFormByMapping } from './filler'

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
  const fields = extractFormStructure(childrenList)
  if (fields.length === 0) {
    throw new Error('No fillable fields found in form data')
  }

  const meta: FieldMeta[] = fields.map(({ label, type, options: opts }) => ({
    label,
    type,
    options: opts?.length ? opts : undefined,
  }))

  const mapping = await options.llmAdapter.call({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? options.llmAdapter.defaultBaseUrl,
    model: options.model ?? options.llmAdapter.defaultModel,
    formStructure: meta,
    userText,
    signal: options.signal,
  })

  return fillFormByMapping(mapping, fields)
}
