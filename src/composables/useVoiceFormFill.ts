import { ref, computed } from 'vue'
import type { LLMAdapter } from '../llm/types'
import { processVoiceFill } from '../core/orchestrator'
import type { FillResult } from '../core/types'

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
  const error = ref<string | null>(null)
  const controller = ref<AbortController | null>(null)

  const hasResult = computed(() => result.value !== null)
  const hasError = computed(() => error.value !== null)

  async function execute(userText: string): Promise<FillResult | null> {
    if (loading.value || !userText.trim()) return null

    loading.value = true
    result.value = null
    error.value = null

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
        error.value = 'No fields matched. Please check your input.'
      }

      return res
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return null
      const msg = e instanceof Error ? e.message : 'Unknown error'
      error.value = msg
      options.onError?.(msg)
      return null
    } finally {
      loading.value = false
      controller.value = null
    }
  }

  function cancel(): void {
    controller.value?.abort()
    loading.value = false
  }

  function reset(): void {
    result.value = null
    error.value = null
  }

  return {
    loading,
    result,
    error,
    hasResult,
    hasError,
    execute,
    cancel,
    reset,
  }
}
