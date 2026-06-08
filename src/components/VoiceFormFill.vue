<template>
  <div class="vff-widget">
    <!-- 悬浮触发按钮 -->
    <div
      class="vff-trigger"
      :class="{ 'vff-recording': isRecording }"
      @click="togglePanel"
    >
      <svg
        v-if="!isRecording"
        class="vff-trigger-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
      <div v-else class="vff-pulse-ring" />
    </div>

    <!-- 遮罩 -->
    <Transition name="vff-fade">
      <div v-if="panelVisible" class="vff-overlay" @click="togglePanel" />
    </Transition>

    <!-- 底部面板 -->
    <Transition name="vff-slide">
      <div v-if="panelVisible" class="vff-panel">
        <!-- Header -->
        <div class="vff-panel-header">
          <span class="vff-panel-title">{{ title }}</span>
          <span class="vff-panel-close" @click="togglePanel">&times;</span>
        </div>

        <div class="vff-panel-body">
          <!-- API Key 缺失提示 -->
          <div v-if="!apiKey" class="vff-hint">
            Please configure your LLM API Key
          </div>

          <!-- Tab 切换：语音 / 文本 -->
          <div
            v-if="sttAvailable && textInput"
            class="vff-tabs"
          >
            <button
              class="vff-tab"
              :class="{ active: activeTab === 'voice' }"
              @click="activeTab = 'voice'"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
              Voice
            </button>
            <button
              class="vff-tab"
              :class="{ active: activeTab === 'text' }"
              @click="activeTab = 'text'"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
              Text
            </button>
          </div>

          <!-- 语音输入区域 -->
          <div v-if="activeTab === 'voice'" class="vff-voice-area">
            <div class="vff-voice-status">
              <span v-if="!isRecording" class="vff-voice-hint">
                Tap the mic to start recording
              </span>
              <span v-else class="vff-voice-recording-label">
                Recording... tap to stop
              </span>
              <span v-if="interimText" class="vff-voice-interim">
                {{ interimText }}
              </span>
            </div>

            <button
              class="vff-mic-btn"
              :class="{ recording: isRecording }"
              :disabled="loading"
              @click="handleVoiceToggle"
            >
              <svg
                v-if="!isRecording"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
              <svg
                v-else
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          </div>

          <!-- 文本输入区域 -->
          <textarea
            v-if="activeTab === 'text'"
            v-model="userText"
            class="vff-text-input"
            :rows="4"
            placeholder="Enter voice content, e.g., 'Name is John Smith, male, ID number is 420106199001011234'"
            :disabled="loading"
          />

          <!-- 提交按钮（文本模式） -->
          <button
            v-if="activeTab === 'text'"
            class="vff-submit-btn"
            :disabled="loading || !userText.trim() || !apiKey"
            @click="handleTextSubmit"
          >
            <span v-if="loading" class="vff-spinner" />
            <span>{{ loading ? 'Filling...' : 'Fill Form' }}</span>
          </button>

          <!-- 结果展示 -->
          <div v-if="result" class="vff-result">
            <div v-if="result.success.length" class="vff-result-row">
              <span class="vff-result-label">Filled:</span>
              <span
                v-for="name in result.success"
                :key="name"
                class="vff-tag vff-tag-ok"
              >{{ name }}</span>
            </div>
            <div v-if="result.failed.length" class="vff-result-row">
              <span class="vff-result-label">Not matched:</span>
              <span
                v-for="name in result.failed"
                :key="name"
                class="vff-tag vff-tag-err"
              >{{ name }}</span>
            </div>
          </div>

          <!-- 错误 -->
          <div v-if="error" class="vff-error">{{ error }}</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { DeepSeekAdapter } from '../llm/deepseek'
import { OpenAIAdapter } from '../llm/openai'
import { GenericLLMAdapter } from '../llm/generic'
import type { LLMAdapter } from '../llm/types'
import { useVoiceFormFill } from '../composables/useVoiceFormFill'
import {
  useSttRecorder,
  type STTAdapterType,
} from '../composables/useSttRecorder'
import { setDebug } from '../core/logger'

const props = withDefaults(
  defineProps<{
    formData: Record<string, any>[]
    apiKey: string
    title?: string
    llmAdapter?: 'deepseek' | 'openai' | 'generic'
    llmConfig?: {
      baseUrl?: string
      model?: string
      temperature?: number
      maxTokens?: number
    }
    sttAdapter?: STTAdapterType
    sttConfig?: {
      lang?: string
      continuous?: boolean
      interimResults?: boolean
      xunfei?: {
        appId: string
        wsUrl: string
      }
    }
    textInput?: boolean
    visible?: boolean
    debug?: boolean
  }>(),
  {
    title: 'Voice Form Fill',
    llmAdapter: 'deepseek',
    sttAdapter: 'web-speech',
    textInput: true,
    visible: false,
    debug: false,
  }
)

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'fill-start'): void
  (e: 'fill-complete', r: { success: string[]; failed: string[] }): void
  (e: 'fill-error', msg: string): void
  (e: 'field-filled', f: { label: string; value: unknown }): void
}>()

// 面板状态
const panelVisible = ref(props.visible)
watch(
  () => props.visible,
  (v) => {
    panelVisible.value = v
  }
)

// 调试模式开关
watch(
  () => props.debug,
  (v) => {
    setDebug(v)
  },
  { immediate: true }
)

// Tab 状态
const activeTab = ref<'voice' | 'text'>('voice')

// STT 适配器是否可用
const sttAvailable = computed(() => props.sttAdapter !== 'none')

// LLM 适配器实例
const adapter = computed<LLMAdapter>(() => {
  switch (props.llmAdapter) {
    case 'openai':
      return new OpenAIAdapter()
    case 'generic':
      return new GenericLLMAdapter()
    case 'deepseek':
    default:
      return new DeepSeekAdapter()
  }
})

// 文本输入
const userText = ref('')

// 表单数据访问器
const getFormData = () => props.formData

// 语音填充编排
const { loading, result, error, execute, reset } = useVoiceFormFill({
  llmAdapter: adapter.value,
  apiKey: props.apiKey,
  baseUrl: props.llmConfig?.baseUrl,
  model: props.llmConfig?.model,
  formData: () => props.formData,
  onSuccess: (r) => {
    emit('fill-complete', r)
  },
  onError: (msg) => {
    emit('fill-error', msg)
  },
})

// STT 录音
const {
  sttState,
  isRecording,
  interimText,
  start: startRecording,
  stop: stopRecording,
  cancel: cancelRecording,
} = useSttRecorder({
  adapter: props.sttAdapter,
  sttConfig: props.sttConfig,
  onText: async (text, isFinal) => {
    if (isFinal) {
      userText.value = text
      activeTab.value = 'text'
      if (text.trim() && props.apiKey) {
        emit('fill-start')
        await execute(text.trim())
      }
    }
  },
  onError: (err) => {
    emit('fill-error', err.message)
  },
})

function togglePanel() {
  panelVisible.value = !panelVisible.value
  emit('update:visible', panelVisible.value)
  if (!panelVisible.value) {
    cancelRecording()
    reset()
    userText.value = ''
    activeTab.value = 'voice'
  }
}

async function handleVoiceToggle() {
  if (isRecording.value) {
    stopRecording()
  } else {
    await startRecording()
  }
}

async function handleTextSubmit() {
  if (!userText.value.trim()) return
  emit('fill-start')
  await execute(userText.value.trim())
}
</script>

<style>
.vff-widget {
  position: fixed;
  right: 16px;
  bottom: 130px;
  z-index: 999;
}

/* 触发按钮 */
.vff-trigger {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1989fa, #4080ff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(25, 137, 250, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
  user-select: none;
}

.vff-trigger:active {
  transform: scale(0.93);
}

.vff-trigger-icon {
  width: 24px;
  height: 24px;
}

.vff-trigger.vff-recording {
  box-shadow: 0 0 0 0 rgba(25, 137, 250, 0.6);
  animation: vff-pulse 1.5s infinite;
}

@keyframes vff-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(25, 137, 250, 0.6);
  }
  70% {
    box-shadow: 0 0 0 14px rgba(25, 137, 250, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(25, 137, 250, 0);
  }
}

.vff-pulse-ring {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ff4757;
  animation: vff-pulse-ring 0.8s ease-in-out infinite alternate;
}

@keyframes vff-pulse-ring {
  from { transform: scale(0.8); opacity: 0.6; }
  to { transform: scale(1.2); opacity: 1; }
}

/* 遮罩 */
.vff-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 998;
}

/* 面板 */
.vff-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: #fff;
  border-radius: 16px 16px 0 0;
  max-height: 70vh;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
}

.vff-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #ebedf0;
}

.vff-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.vff-panel-close {
  font-size: 24px;
  color: #969799;
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vff-panel-body {
  padding: 16px 20px;
}

/* Hint */
.vff-hint {
  padding: 10px 14px;
  background: #fff7e6;
  border: 1px solid #ffd666;
  border-radius: 8px;
  font-size: 13px;
  color: #d46b08;
  margin-bottom: 12px;
}

/* Tabs */
.vff-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.vff-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  border: 1px solid #dcdee0;
  border-radius: 8px;
  background: #f7f8fa;
  color: #646566;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.vff-tab.active {
  background: #1989fa;
  color: #fff;
  border-color: #1989fa;
}

/* 语音区域 */
.vff-voice-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 0;
}

.vff-voice-status {
  text-align: center;
  min-height: 40px;
}

.vff-voice-hint {
  font-size: 14px;
  color: #969799;
}

.vff-voice-recording-label {
  font-size: 14px;
  color: #ee0a24;
  font-weight: 500;
}

.vff-voice-interim {
  display: block;
  margin-top: 8px;
  padding: 8px 12px;
  background: #f0f9ff;
  border-radius: 8px;
  font-size: 13px;
  color: #323233;
  max-width: 280px;
  word-break: break-all;
}

/* 麦克风按钮 */
.vff-mic-btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  background: #f0f2f5;
  color: #323233;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.vff-mic-btn.recording {
  background: #ee0a24;
  color: #fff;
  box-shadow: 0 0 0 8px rgba(238, 10, 36, 0.15);
}

.vff-mic-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 文本输入 */
.vff-text-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dcdee0;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: #323233;
  resize: none;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  -webkit-appearance: none;
}

.vff-text-input:focus {
  border-color: #1989fa;
}

.vff-text-input:disabled {
  background: #f7f8fa;
}

.vff-text-input::placeholder {
  color: #c8c9cc;
}

/* 提交按钮 */
.vff-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
  padding: 12px 0;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #1989fa, #4080ff);
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.vff-submit-btn:disabled {
  opacity: 0.5;
}

/* Spinner */
.vff-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: vff-spin 0.8s linear infinite;
}

@keyframes vff-spin {
  to { transform: rotate(360deg); }
}

/* 结果 */
.vff-result {
  margin-top: 12px;
}

.vff-result-row {
  margin-top: 8px;
  font-size: 13px;
}

.vff-result-label {
  color: #646566;
  margin-right: 6px;
}

.vff-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-right: 6px;
  margin-bottom: 4px;
}

.vff-tag-ok {
  background: #e8f8e8;
  color: #07c160;
}

.vff-tag-err {
  background: #fee;
  color: #ee0a24;
}

/* 错误 */
.vff-error {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 8px;
  font-size: 13px;
  color: #ee0a24;
  word-break: break-all;
}

/* 过渡动画 */
.vff-fade-enter-active,
.vff-fade-leave-active {
  transition: opacity 0.25s;
}
.vff-fade-enter-from,
.vff-fade-leave-to {
  opacity: 0;
}

.vff-slide-enter-active,
.vff-slide-leave-active {
  transition: transform 0.3s ease;
}
.vff-slide-enter-from,
.vff-slide-leave-to {
  transform: translateY(100%);
}
</style>
