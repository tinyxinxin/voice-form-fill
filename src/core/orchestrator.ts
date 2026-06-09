import type { FieldMeta, FillResult } from './types'
import type { LLMAdapter, StreamCallbacks } from '../llm/types'
import { extractFormStructure } from './extractor'
import { fillFormByMapping, fillFieldValue, typewriteFieldValue, matchLabel } from './filler'
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

/**
 * 流式版完整流程：提取表单 → 流式调 LLM → 增量回填（带 typewriter 动画）
 * 每个字段在 LLM 输出到达时立即回填，无需等待完整响应。
 *
 * @param userText - 用户输入文本
 * @param childrenList - 表单子项列表
 * @param options - 编排选项
 * @param onChunk - 原始 token 回调（用于外部展示流式输出）
 * @param useTypewriter - 是否启用逐字动画，默认 true
 */
export async function processVoiceFillStream(
  userText: string,
  childrenList: Record<string, any>[],
  options: OrchestratorOptions,
  onChunk?: (chunk: string) => void,
  useTypewriter?: boolean
): Promise<FillResult> {
  const t0 = performance.now()

  const fields = extractFormStructure(childrenList)
  debug(
    'Extracted',
    fields.length,
    'form fields from',
    childrenList.length,
    'children'
  )
  if (fields.length === 0) {
    throw new Error('No fillable fields found in form data')
  }

  const meta: FieldMeta[] = fields.map(({ label, type, options: opts }) => ({
    label,
    type,
    options: opts?.length ? opts : undefined,
  }))

  const labels = fields.map((f) => f.label)
  const filledKeys = new Set<string>()
  const success: string[] = []
  const failed: string[] = []
  let finalMapping: Record<string, unknown> = {}

  const streamCallbacks: StreamCallbacks = {
    onToken: (token) => {
      onChunk?.(token)
    },
    onField: (key, value) => {
      if (filledKeys.has(key)) return
      filledKeys.add(key)

      if (value == null || value === '') return

      const matchedLabel = matchLabel(key, labels)
      if (!matchedLabel) {
        failed.push(key)
        return
      }

      const matchedFields = fields.filter((f) => f.label === matchedLabel)
      let anySuccess = false
      for (const field of matchedFields) {
        if (useTypewriter === false) {
          if (fillFieldValue(field, value)) anySuccess = true
        } else {
          typewriteFieldValue(field, value)
          anySuccess = true
        }
      }

      if (anySuccess) {
        success.push(matchedLabel)
      } else {
        failed.push(key)
      }
    },
    onComplete: (mapping) => {
      finalMapping = mapping
    },
    onError: (err) => {
      debug('Stream error:', err.message)
    },
  }

  debug(
    'Calling LLM adapter (stream):',
    options.llmAdapter.name,
    'model:',
    options.model ?? options.llmAdapter.defaultModel
  )
  const t1 = performance.now()

  await options.llmAdapter.callStream(
    {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl ?? options.llmAdapter.defaultBaseUrl,
      model: options.model ?? options.llmAdapter.defaultModel,
      formStructure: meta,
      userText,
      signal: options.signal,
    },
    streamCallbacks
  )

  debug(
    'Stream LLM response complete',
    `(${((performance.now() - t1) / 1000).toFixed(2)}s)`
  )

  // 安全网：用最终 mapping 补填流式过程中遗漏的字段
  if (finalMapping && Object.keys(finalMapping).length > 0) {
    const safetyResult = fillFormByMapping(finalMapping, fields)
    for (const label of safetyResult.success) {
      if (!success.includes(label)) {
        success.push(label)
      }
    }
  }

  const result: FillResult = { success, failed }
  debug(
    'Fill result:',
    result,
    `(total: ${((performance.now() - t0) / 1000).toFixed(2)}s)`
  )
  return result
}
