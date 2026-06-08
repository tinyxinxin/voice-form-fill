const TAG = '[VoiceFormFill]'

let debugEnabled = false

/**
 * Enable or disable debug-level logging.
 * Default: false (off).
 */
export function setDebug(enabled: boolean): void {
  debugEnabled = enabled
}

/**
 * Whether debug logging is currently enabled.
 */
export function isDebugEnabled(): boolean {
  return debugEnabled
}

/**
 * Debug log – only prints when debug is enabled via setDebug(true).
 */
export function debug(...args: unknown[]): void {
  if (debugEnabled) {
    console.log(TAG, ...args)
  }
}

/**
 * Warning log – always prints.
 */
export function warn(...args: unknown[]): void {
  console.warn(TAG, ...args)
}

/**
 * Error log – always prints.
 */
export function error(...args: unknown[]): void {
  console.error(TAG, ...args)
}
