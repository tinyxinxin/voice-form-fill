import type { STTAdapter, STTState, STTError, STTStartOptions } from './types'

/**
 * 浏览器 Web Speech API 适配器（免费，Chrome/Edge 内置）
 */
export class WebSpeechSTTAdapter implements STTAdapter {
  readonly name = 'web-speech'

  private recognition: any = null
  private resultCb: ((text: string, isFinal: boolean) => void) | null = null
  private errorCb: ((error: STTError) => void) | null = null
  private stateCb: ((state: STTState) => void) | null = null
  private sttState: STTState = 'idle'

  isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }

  start(options?: STTStartOptions): void {
    if (!this.isSupported()) {
      this.emitError({
        code: 'NOT_SUPPORTED',
        message: 'Web Speech API is not supported in this browser',
      })
      return
    }

    const SpeechAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    this.recognition = new SpeechAPI()

    this.recognition.lang =
      options?.lang ?? navigator.language ?? 'zh-CN'
    this.recognition.continuous = options?.continuous ?? true
    this.recognition.interimResults = options?.interimResults ?? true

    this.recognition.onstart = () => this.setState('recording')
    this.recognition.onend = () => {
      if (this.sttState === 'recording') this.setState('done')
    }
    this.recognition.onerror = (event: any) => {
      this.emitError({
        code: event.error,
        message: `Speech recognition error: ${event.error}`,
      })
    }
    this.recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      if (finalText) this.resultCb?.(finalText, true)
      else if (interimText) this.resultCb?.(interimText, false)
    }

    this.setState('requesting-mic')
    this.recognition.start()
  }

  stop(): void {
    this.recognition?.stop()
  }

  cancel(): void {
    this.recognition?.abort()
    this.setState('idle')
  }

  destroy(): void {
    this.cancel()
    this.recognition = null
    this.resultCb = null
    this.errorCb = null
    this.stateCb = null
  }

  onResult(callback: (text: string, isFinal: boolean) => void): void {
    this.resultCb = callback
  }

  onError(callback: (error: STTError) => void): void {
    this.errorCb = callback
  }

  onStateChange(callback: (state: STTState) => void): void {
    this.stateCb = callback
  }

  private setState(state: STTState): void {
    this.sttState = state
    this.stateCb?.(state)
  }

  private emitError(error: STTError): void {
    this.setState('error')
    this.errorCb?.(error)
  }
}
