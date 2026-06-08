import { ref, computed } from 'vue'
import type { LLMAdapter } from '../llm/types'
import { processVoiceFill } from '../core/orchestrator'
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
      const formData = options.formData()
      const allItems: Record<string, any>[] = []
      formData.forEach((form) => {
        if (form.childrenList?.length) {
          allItems.push(...form.childrenList)
        }
      })

      debug('Flattened form data:', allItems.length, 'items from', formData.length, 'forms')

      const res = await processVoiceFill(userText, allItems, {
        llmAdapter: options.llmAdapter,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl ?? options.llmAdapter.defaultBaseUrl,
        model: options.model ?? options.llmAdapter.defaultModel,
        signal: abortController.signal,
      })

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
    execute,
    cancel,
    reset,
  }
}
