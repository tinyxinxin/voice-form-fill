# voice-form-fill

> 🎤 Vue 3 语音/文本智能填表组件。用自然语言描述内容，大模型自动提取信息并填充到表单字段。

[![npm version](https://img.shields.io/npm/v/voice-form-fill)](https://www.npmjs.com/package/voice-form-fill)
[![License](https://img.shields.io/npm/l/voice-form-fill)](LICENSE)

[English](./README.md)

## 特性

- **🎤 语音输入** — 内置浏览器 Web Speech API（免费）+ 讯飞语音识别（中文优化）
- **🤖 多模型支持** — DeepSeek、OpenAI 及任何 OpenAI 兼容接口（Ollama、vLLM 等）
- **🧩 插件式架构** — LLM/STT 采用策略模式，轻松扩展
- **📦 零依赖** — 仅 Vue 3 作为 peer 依赖，全部使用浏览器原生 API
- **🎨 精美 UI** — 悬浮麦克风按钮、底部面板、录音/文本双模式、过渡动画
- **🔌 框架无关核心** — 核心提取/填充逻辑不依赖 Vue
- **📘 完整 TypeScript** — 类型声明齐全

## 快速开始

### 安装

```bash
npm install voice-form-fill
```

### 基础用法

```vue
<template>
  <div>
    <!-- 你的表单字段 -->
    <input v-model="formData[0].childrenList[0].value" placeholder="姓名" />
    <input v-model="formData[0].childrenList[1].value" placeholder="手机号" />

    <VoiceFormFill
      :form-data="formData"
      api-key="sk-your-deepseek-api-key"
      @fill-complete="onComplete"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { VoiceFormFill } from 'voice-form-fill'
import 'voice-form-fill/style.css'

const formData = ref([
  {
    childrenList: [
      { title: '姓名', componentType: '0', value: '' },
      { title: '手机号', componentType: '0', value: '' },
    ],
  },
])

function onComplete(result) {
  console.log('已填充:', result.success)
  console.log('未匹配:', result.failed)
}
</script>
```

## 配置说明

### LLM 适配器

```vue
<!-- DeepSeek（默认，推荐中文场景） -->
<VoiceFormFill
  llm-adapter="deepseek"
  api-key="sk-your-deepseek-key"
/>

<!-- OpenAI -->
<VoiceFormFill
  llm-adapter="openai"
  api-key="sk-your-openai-key"
  :llm-config="{ model: 'gpt-4o' }"
/>

<!-- Ollama / 本地模型 -->
<VoiceFormFill
  llm-adapter="generic"
  api-key=""
  :llm-config="{
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3'
  }"
/>
```

### 语音识别适配器

```vue
<!-- Web Speech API（默认，免费，需 Chrome/Edge） -->
<VoiceFormFill stt-adapter="web-speech" />

<!-- 讯飞语音识别（中文优化，需配置 appId） -->
<VoiceFormFill
  stt-adapter="xunfei"
  :stt-config="{
    xunfei: {
      appId: 'your-xunfei-app-id',
      wsUrl: 'wss://iat-api.xfyun.cn/v2/iat'
    }
  }"
/>

<!-- 纯文本模式 -->
<VoiceFormFill stt-adapter="none" />
```

## 组件 API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `formData` | `Record<string, any>[]` | — | 表单数据（含 childrenList） |
| `apiKey` | `string` | — | LLM API Key |
| `title` | `string` | `'语音填表'` | 面板标题 |
| `llmAdapter` | `'deepseek' \| 'openai' \| 'generic'` | `'deepseek'` | LLM 提供商 |
| `llmConfig` | `{ baseUrl?, model?, temperature?, maxTokens? }` | — | LLM 配置选项 |
| `sttAdapter` | `'web-speech' \| 'xunfei' \| 'none'` | `'web-speech'` | 语音识别提供商 |
| `sttConfig` | `object` | — | STT 配置选项 |
| `textInput` | `boolean` | `true` | 显示文本输入标签页 |
| `visible` | `boolean` | `false` | 面板可见性（支持 v-model） |

### 事件

| 事件 | 参数 | 说明 |
|------|------|------|
| `fill-start` | — | 填充开始 |
| `fill-complete` | `{ success: string[], failed: string[] }` | 填充完成 |
| `fill-error` | `string` | 错误信息 |
| `field-filled` | `{ label: string, value: unknown }` | 单个字段已填充 |
| `update:visible` | `boolean` | 面板可见性变化 |

### 插槽

| 插槽 | 参数 | 说明 |
|------|------|------|
| `trigger` | `{ toggle, recording }` | 自定义触发按钮 |
| `header` | `{ title, close }` | 自定义面板头部 |
| `result` | `{ success, failed, loading }` | 自定义结果展示 |

## 进阶用法

### 使用 Composables

```typescript
import { useVoiceFormFill, useSttRecorder, DeepSeekAdapter } from 'voice-form-fill'

const { loading, result, error, execute } = useVoiceFormFill({
  llmAdapter: new DeepSeekAdapter(),
  apiKey: 'sk-xxx',
  formData: () => myFormData,
  onSuccess: (r) => console.log('已填充:', r),
})

// 文本填充
await execute('姓名张三，手机号13800138000')
```

### 使用核心模块（不依赖 Vue）

```typescript
import { processVoiceFill, DeepSeekAdapter } from 'voice-form-fill'

const result = await processVoiceFill(
  '姓名张三，手机号13800138000',
  childrenList,
  {
    llmAdapter: new DeepSeekAdapter(),
    apiKey: 'sk-xxx',
  }
)
// result: { success: ['姓名', '手机号'], failed: [] }
```

### 自定义 LLM 适配器

```typescript
import type { LLMAdapter, LLMCallOptions } from 'voice-form-fill'

class MyCustomAdapter implements LLMAdapter {
  readonly name = 'my-adapter'
  readonly defaultBaseUrl = 'https://my-api.example.com/v1'
  readonly defaultModel = 'my-model'

  async call(options: LLMCallOptions): Promise<Record<string, unknown>> {
    // 在这里实现你的调用逻辑
  }
}
```

## 浏览器支持

| 功能 | Chrome | Edge | Safari | Firefox |
|------|--------|------|--------|---------|
| Web Speech API | ✅ | ✅ | ✅ | ❌ |
| 讯飞语音识别 | ✅ | ✅ | ✅ | ✅ |
| 文本输入 | ✅ | ✅ | ✅ | ✅ |

## License

MIT
