export type STTState =
  | 'idle'
  | 'requesting-mic'
  | 'recording'
  | 'processing'
  | 'done'
  | 'error'

export interface STTError {
  code: string
  message: string
  original?: unknown
}

export interface STTStartOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
}

export interface STTAdapter {
  readonly name: string
  isSupported(): boolean
  start(options?: STTStartOptions): void
  stop(): void
  cancel(): void
  destroy(): void
  onResult(callback: (text: string, isFinal: boolean) => void): void
  onError(callback: (error: STTError) => void): void
  onStateChange(callback: (state: STTState) => void): void
}
