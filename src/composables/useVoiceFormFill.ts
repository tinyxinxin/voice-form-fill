import { ref, computed } from 'vue'
import type { LLMAdapter } from '../llm/types'
import { processVoiceFill, processVoiceFillStream } from '../core/orchestrator'
import type { FillResult } from '../core/types'
import { debug, error } from '../core/logger'

export interface UseVoiceFormFillOptions {
  llmAdapter: LLMAdapter
  apiKey: string
  baseUrl?: string
  model?: string
  formData: () => Record<string, any>[]
  onSuccess?: (result: FillResult) => void
  onError?: (error: string) => void
}

export function useVoiceFormFill(options: UseVoiceFormFillOptions) {
  const loading = ref(false)
  const result = ref<FillResult | null>(null)
  const err = ref<string | null>(null)
  const controller = ref<AbortController | null>(null)
  /** 流式输出的原始文本 */
  const streamText = ref('')
  /** 是否启用流式返回，默认 true */
  const streamEnabled = ref(true)

  const hasResult = computed(() => result.value !== null)
  const hasError = computed(() => err.value !== null)

  async function execute(userText: string): Promise<FillResult | null> {
    if (loading.value || !userText.trim()) return null

    debug('useVoiceFormFill.execute starting, userText length:', userText.length)

    loading.value = true
    result.value = null
    err.value = null

    const abortController = new AbortController()
    controller.value = abortController

    try {
      const raw = options.formData()
      const formData = Array.isArray(raw) ? raw : [raw]
      const allItems: Record<string, any>[] = []
      let isFlat = false

      formData.forEach((form) => {
        if (form.childrenList?.length) {
          allItems.push(...form.childrenList)
        } else if (typeof form === 'object' && form !== null) {
          // Flat object mode: auto-generate items from top-level keys
          isFlat = true
          const keys = Object.keys(form).filter(
            (k) => typeof form[k] !== 'function'
          )
          keys.forEach((key) => {
            allItems.push({
              title: key,
              componentType: '0',
              value: form[key],
              _flatKey: key,
              _flatParent: form,
            })
          })
        }
      })

      debug(
        'Flattened form data:',
        allItems.length,
        'items from',
        formData.length,
        'forms',
        isFlat ? '(flat mode)' : ''
      )

      const res = await processVoiceFill(userText, allItems, {
        llmAdapter: options.llmAdapter,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl ?? options.llmAdapter.defaultBaseUrl,
        model: options.model ?? options.llmAdapter.defaultModel,
        signal: abortController.signal,
      })

      // Sync flat object values back to the original object
      if (isFlat) {
        allItems.forEach((item) => {
          if (item._flatParent && item._flatKey) {
            item._flatParent[item._flatKey] = item.value
          }
        })
      }

      result.value = res
      options.onSuccess?.(res)

      if (res.failed.length && res.success.length === 0) {
        err.value = 'No fields matched. Please check your input.'
      }

      debug('useVoiceFormFill.execute complete, success:', res.success, 'failed:', res.failed)
      return res
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        debug('useVoiceFormFill.execute aborted')
        return null
      }
      const msg = e instanceof Error ? e.message : 'Unknown error'
      err.value = msg
      error('useVoiceFormFill.execute error:', msg)
      options.onError?.(msg)
      return null
    } finally {
      loading.value = false
      controller.value = null
    }
  }

  /**
   * 流式执行：逐 token 返回并增量回填表单
   * 与 execute 互斥，流式模式下停用 typewriter（由 stream 自身逐帧到达形成动画）
   */
  async function executeStream(userText: string): Promise<FillResult | null> {
    if (loading.value || !userText.trim()) return null

    debug('useVoiceFormFill.executeStream starting, userText length:', userText.length)

    loading.value = true
    result.value = null
    err.value = null
    streamText.value = ''

    const abortController = new AbortController()
    controller.value = abortController

    try {
      const raw = options.formData()
      const formData = Array.isArray(raw) ? raw : [raw]
      const allItems: Record<string, any>[] = []
      let isFlat = false

      formData.forEach((form) => {
        if (form.childrenList?.length) {
          allItems.push(...form.childrenList)
        } else if (typeof form === 'object' && form !== null) {
          isFlat = true
          const keys = Object.keys(form).filter(
            (k) => typeof form[k] !== 'function'
          )
          keys.forEach((key) => {
            allItems.push({
              title: key,
              componentType: '0',
              value: form[key],
              _flatKey: key,
              _flatParent: form,
            })
          })
        }
      })

      debug(
        'Flattened form data:',
        allItems.length,
        'items from',
        formData.length,
        'forms',
        isFlat ? '(flat mode)' : ''
      )

      const res = await processVoiceFillStream(
        userText,
        allItems,
        {
          llmAdapter: options.llmAdapter,
          apiKey: options.apiKey,
          baseUrl: options.baseUrl ?? options.llmAdapter.defaultBaseUrl,
          model: options.model ?? options.llmAdapter.defaultModel,
          signal: abortController.signal,
        },
        (chunk) => {
          streamText.value += chunk
        },
        false // streaming already provides visual progress, no extra typewriter needed
      )

      if (isFlat) {
        allItems.forEach((item) => {
          if (item._flatParent && item._flatKey) {
            item._flatParent[item._flatKey] = item.value
          }
        })
      }

      result.value = res
      options.onSuccess?.(res)

      if (res.failed.length && res.success.length === 0) {
        err.value = 'No fields matched. Please check your input.'
      }

      debug(
        'useVoiceFormFill.executeStream complete, success:',
        res.success,
        'failed:',
        res.failed
      )
      return res
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        debug('useVoiceFormFill.executeStream aborted')
        return null
      }
      const msg = e instanceof Error ? e.message : 'Unknown error'
      err.value = msg
      error('useVoiceFormFill.executeStream error:', msg)
      options.onError?.(msg)
      return null
    } finally {
      loading.value = false
      controller.value = null
    }
  }

  function cancel(): void {
    debug('useVoiceFormFill.cancel')
    controller.value?.abort()
    loading.value = false
  }

  function reset(): void {
    debug('useVoiceFormFill.reset')
    result.value = null
    err.value = null
  }

  return {
    loading,
    result,
    error: err,
    hasResult,
    hasError,
    streamText,
    streamEnabled,
    execute,
    executeStream,
    cancel,
    reset,
  }
}
