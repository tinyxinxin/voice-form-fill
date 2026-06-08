import { ref, onUnmounted, watch } from 'vue'
import type { STTAdapter, STTState, STTError } from '../stt/types'
import { WebSpeechSTTAdapter } from '../stt/web-speech'
import { XunfeiSTTAdapter, type XunfeiSTTConfig } from '../stt/xunfei'
import { debug, warn } from '../core/logger'

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
          warn('Xunfei adapter requires appId and wsUrl')
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
    debug('STT start, adapter:', options.adapter)
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
      debug('STT state changed:', state)
      sttState.value = state
    })

    sttAdapter.onResult((text, isFinal) => {
      debug('STT result:', isFinal ? 'FINAL' : 'interim', text)
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
    debug('STT stop')
    sttAdapter?.stop()
    isRecording.value = false
  }

  function cancel(): void {
    debug('STT cancel')
    sttAdapter?.cancel()
    isRecording.value = false
    interimText.value = ''
  }

  watch(
    () => options.adapter,
    () => {
      debug('STT adapter changed:', options.adapter)
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
