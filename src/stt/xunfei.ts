import type { STTAdapter, STTState, STTError, STTStartOptions } from './types'
import { debug } from '../core/logger'

export interface XunfeiSTTConfig {
  appId: string
  wsUrl: string
  lang?: string
  accent?: string
  vadEos?: number
  channel?: number
}

/**
 * 讯飞语音识别 WebSocket 适配器
 *
 * 使用前需在讯飞开放平台 (console.xfyun.cn) 创建应用获取 appId，
 * WebSocket 地址通常为: wss://iat-api.xfyun.cn/v2/iat
 *
 * 认证需要使用 HMAC-SHA256 签名，参考讯飞 API 文档：
 * https://www.xfyun.cn/doc/asr/voicedictation/API.html
 */
export class XunfeiSTTAdapter implements STTAdapter {
  readonly name = 'xunfei'

  private config: Required<XunfeiSTTConfig>
  private ws: WebSocket | null = null
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private resultCb: ((text: string, isFinal: boolean) => void) | null = null
  private errorCb: ((error: STTError) => void) | null = null
  private stateCb: ((state: STTState) => void) | null = null
  private sttState: STTState = 'idle'

  // 音频缓冲区
  private audioData = {
    size: 0,
    buffer: [] as Float32Array[],
    inputSampleRate: 48000,
    inputSampleBits: 16,
    outputSampleRate: 16000,
    oututSampleBits: 16,

    clear() {
      this.buffer = []
      this.size = 0
    },

    input(data: Float32Array) {
      this.buffer.push(new Float32Array(data))
      this.size += data.length
    },

    compress(): Float32Array {
      const data = new Float32Array(this.size)
      let offset = 0
      for (const buf of this.buffer) {
        data.set(buf, offset)
        offset += buf.length
      }
      const compression = Math.floor(
        this.inputSampleRate / this.outputSampleRate
      )
      const length = data.length / compression
      const result = new Float32Array(length)
      let index = 0
      let j = 0
      while (index < length) {
        result[index] = data[j]
        j += compression
        index++
      }
      return result
    },

    encodePCM(): ArrayBuffer {
      const sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits)
      const bytes = this.compress()
      const dataLength = bytes.length * (sampleBits / 8)
      const buffer = new ArrayBuffer(dataLength)
      const dataView = new DataView(buffer)
      let offset = 0
      for (let i = 0; i < bytes.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, bytes[i]))
        dataView.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true)
      }
      return buffer
    },
  }

  // 语音识别结果
  private resultText = ''
  private resultTextTemp = ''

  constructor(config: XunfeiSTTConfig) {
    this.config = {
      appId: config.appId,
      wsUrl: config.wsUrl,
      lang: config.lang ?? 'zh_cn',
      accent: config.accent ?? 'mandarin',
      vadEos: config.vadEos ?? 1000,
      channel: config.channel ?? 1,
    }
  }

  isSupported(): boolean {
    return (
      typeof WebSocket !== 'undefined' &&
      typeof navigator?.mediaDevices?.getUserMedia !== 'undefined' &&
      typeof AudioContext !== 'undefined'
    )
  }

  start(_options?: STTStartOptions): void {
    debug('Xunfei start')
    if (!this.isSupported()) {
      this.emitError({
        code: 'NOT_SUPPORTED',
        message: 'iFlytek ASR is not supported in this environment',
      })
      return
    }

    this.setState('requesting-mic')

    const channelCount =
      this.config.channel === 2 ? 2 : 1

    const mediaOptions: MediaStreamConstraints =
      channelCount === 2
        ? {
            audio: {
              sampleRate: 48000,
              channelCount: 2,
              echoCancellation: false,
              noiseSuppression: false,
            },
          }
        : { audio: true }

    navigator.mediaDevices
      .getUserMedia(mediaOptions)
      .then((stream) => {
        this.mediaStream = stream
        this.initAudioCapture(stream)
        this.connectWebSocket()
      })
      .catch((err) => {
        const msg = JSON.stringify(err.message || err.name || err)
        switch (err.message || err.name) {
          case 'PERMISSION_DENIED':
          case 'PermissionDeniedError':
          case 'MANDATORY_UNSATISFIED_ERROR':
          case 'MandatoryUnsatisfiedError':
            this.emitError({
              code: 'PERMISSION_DENIED',
              message: `Microphone permission denied: ${msg}`,
              original: err,
            })
            break
          case 'NOT_SUPPORTED_ERROR':
          case 'NotSupportedError':
            this.emitError({
              code: 'NO_DEVICE',
              message: `No recording device available: ${msg}`,
              original: err,
            })
            break
          default:
            this.emitError({
              code: 'UNKNOWN',
              message: `Failed to access microphone: ${msg}`,
              original: err,
            })
        }
      })
  }

  stop(): void {
    debug('Xunfei stop')
    this.scriptProcessor?.disconnect()
    if (this.ws) {
      // 发送结束帧
      this.ws.send(
        JSON.stringify({
          data: {
            status: 2,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: '',
          },
        })
      )
    }
  }

  cancel(): void {
    debug('Xunfei cancel')
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.scriptProcessor?.disconnect()
    this.cleanupAudio()
    this.setState('idle')
  }

  destroy(): void {
    this.cancel()
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

  // ---- 私有方法 ----

  private setState(state: STTState): void {
    this.sttState = state
    this.stateCb?.(state)
  }

  private emitError(error: STTError): void {
    this.setState('error')
    this.errorCb?.(error)
  }

  private initAudioCapture(stream: MediaStream): void {
    this.audioContext = new AudioContext()
    const source = this.audioContext.createMediaStreamSource(stream)
    const channelCount =
      this.config.channel === 2 ? 2 : 1

    this.scriptProcessor = this.audioContext.createScriptProcessor(
      8192,
      channelCount,
      channelCount
    )

    let leftData = this.audioData

    if (channelCount === 2) {
      leftData = { ...this.audioData }
      leftData.clear()
    }

    this.scriptProcessor.onaudioprocess = (e) => {
      if (channelCount === 2) {
        const leftChannelData = e.inputBuffer.getChannelData(0)
        leftData.input(leftChannelData)
        this.sendAudio(leftData.encodePCM())
      } else {
        const inputBuffer = e.inputBuffer.getChannelData(0)
        this.audioData.input(inputBuffer)
        this.sendAudio(this.audioData.encodePCM())
        this.audioData.clear()
      }
    }

    source.connect(this.scriptProcessor)
    this.scriptProcessor.connect(this.audioContext.destination)
  }

  private connectWebSocket(): void {
    const { appId, wsUrl, lang, accent, vadEos } = this.config

    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      debug('Xunfei WebSocket connected')
      // 发送初始化参数
      const params = {
        common: { app_id: appId },
        business: {
          language: lang,
          domain: 'iat',
          accent,
          vad_eos: vadEos,
          dwa: 'wpgs',
        },
        data: {
          status: 0,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
        },
      }
      this.ws!.send(JSON.stringify(params))
      this.resultText = ''
      this.resultTextTemp = ''
    }

    this.ws.onmessage = (e) => {
      this.renderResult(e.data)
    }

    this.ws.onclose = () => {
      this.ws = null
      this.scriptProcessor?.disconnect()
      this.cleanupAudio()
    }

    this.ws.onerror = () => {
      this.emitError({
        code: 'NETWORK_ERROR',
        message: 'Network disconnected',
      })
    }
  }

  private renderResult(resultData: string): void {
    const jsonData = JSON.parse(resultData)

    if (jsonData.data && jsonData.data.result) {
      const data = jsonData.data.result
      let str = ''
      const ws = data.ws
      for (let i = 0; i < ws.length; i++) {
        str = str + ws[i].cw[0].w
      }

      if (data.pgs) {
        if (data.pgs === 'apd') {
          this.resultText = this.resultTextTemp
        }
        this.resultTextTemp = this.resultText + str
      } else {
        this.resultText = this.resultText + str
      }

      this.resultCb?.(this.resultTextTemp || this.resultText, false)
    }

    if (jsonData.code === 0 && jsonData.data?.status === 2) {
      debug('Xunfei recognition done')
      this.ws?.close()
      this.resultCb?.(this.resultTextTemp || this.resultText, true)
      this.setState('done')
    }

    if (jsonData.code !== 0) {
      this.ws?.close()
      this.emitError({
        code: String(jsonData.code),
        message: jsonData.message ?? 'Recognition error',
      })
    }
  }

  private sendAudio(arrayBuffer: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const base64 = this.arrayBufferToBase64(arrayBuffer)
    this.ws.send(
      JSON.stringify({
        data: {
          status: 1,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: base64,
        },
      })
    )
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private cleanupAudio(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.audioData.clear()
  }
}
