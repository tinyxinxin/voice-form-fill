import { ref, onUnmounted, watch } from 'vue'
import type { STTAdapter, STTState, STTError } from '../stt/types'
import { WebSpeechSTTAdapter } from '../stt/web-speech'
import { XunfeiSTTAdapter, type XunfeiSTTConfig } from '../stt/xunfei'

export type STTAdapterType = 'web-speech' | 'xunfei' | 'none'

export interface UseSttRecorderOptions {
  adapter: STTAdapterType
  sttConfig?: {
    lang?: string
    continuous?: boolean
    interimResults?: boolean
    xunfei?: XunfeiSTTConfig
  }
  onText?: (text: string, isFinal: boolean) => void
  onError?: (error: STTError) => void
}

export function useSttRecorder(options: UseSttRecorderOptions) {
  const sttState = ref<STTState>('idle')
  const isRecording = ref(false)
  const interimText = ref('')

  let sttAdapter: STTAdapter | null = null

  function createAdapter(): STTAdapter | null {
    switch (options.adapter) {
      case 'web-speech':
        return new WebSpeechSTTAdapter()
      case 'xunfei': {
        const cfg = options.sttConfig?.xunfei
        if (!cfg?.appId || !cfg?.wsUrl) {
          console.warn('[VoiceFormFill] Xunfei adapter requires appId and wsUrl')
          return null
        }
        return new XunfeiSTTAdapter(cfg)
      }
      case 'none':
        return null
      default:
        return new WebSpeechSTTAdapter()
    }
  }

  function start(): void {
    sttAdapter = createAdapter()
    if (!sttAdapter) {
      options.onError?.({
        code: 'NO_ADAPTER',
        message: 'No STT adapter available. Check your configuration.',
      })
      return
    }

    if (!sttAdapter.isSupported()) {
      options.onError?.({
        code: 'NOT_SUPPORTED',
        message: `${sttAdapter.name} is not supported in this browser`,
      })
      return
    }

    isRecording.value = true
    interimText.value = ''

    sttAdapter.onStateChange((state) => {
      sttState.value = state
    })

    sttAdapter.onResult((text, isFinal) => {
      interimText.value = text
      options.onText?.(text, isFinal)
      if (isFinal) {
        isRecording.value = false
      }
    })

    sttAdapter.onError((err) => {
      isRecording.value = false
      options.onError?.(err)
    })

    sttAdapter.start({
      lang: options.sttConfig?.lang ?? 'zh-CN',
      continuous: options.sttConfig?.continuous ?? true,
      interimResults: options.sttConfig?.interimResults ?? true,
    })
  }

  function stop(): void {
    sttAdapter?.stop()
    isRecording.value = false
  }

  function cancel(): void {
    sttAdapter?.cancel()
    isRecording.value = false
    interimText.value = ''
  }

  watch(
    () => options.adapter,
    () => {
      sttAdapter?.destroy()
      sttAdapter = null
      isRecording.value = false
    }
  )

  onUnmounted(() => {
    sttAdapter?.destroy()
  })

  return {
    sttState,
    isRecording,
    interimText,
    start,
    stop,
    cancel,
    isSupported: () => sttAdapter?.isSupported() ?? false,
  }
}
