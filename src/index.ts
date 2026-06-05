// Vue 组件
export { default as VoiceFormFill } from './components/VoiceFormFill.vue'

// Composables
export { useVoiceFormFill } from './composables/useVoiceFormFill'
export { useSttRecorder } from './composables/useSttRecorder'
export type {
  UseVoiceFormFillOptions,
} from './composables/useVoiceFormFill'
export type {
  STTAdapterType,
  UseSttRecorderOptions,
} from './composables/useSttRecorder'

// Core
export { extractFormStructure } from './core/extractor'
export { fillFieldValue, fillFormByMapping, matchLabel } from './core/filler'
export { processVoiceFill } from './core/orchestrator'
export type { FieldMeta, FormField, FillResult } from './core/types'
export type { OrchestratorOptions } from './core/orchestrator'

// LLM Adapters
export { DeepSeekAdapter } from './llm/deepseek'
export { OpenAIAdapter } from './llm/openai'
export { GenericLLMAdapter } from './llm/generic'
export { buildPrompt, parseJsonFromLLMResponse } from './llm/types'
export type { LLMAdapter, LLMCallOptions } from './llm/types'

// STT Adapters
export { WebSpeechSTTAdapter } from './stt/web-speech'
export { XunfeiSTTAdapter } from './stt/xunfei'
export type { XunfeiSTTConfig } from './stt/xunfei'
export type { STTAdapter, STTState, STTError, STTStartOptions } from './stt/types'
