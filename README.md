# voice-form-fill

> 🎤 Voice/text-to-form auto-filling component for Vue 3. Speak or type natural language, and an LLM extracts structured data to fill form fields.

[![npm version](https://img.shields.io/npm/v/voice-form-fill)](https://www.npmjs.com/package/voice-form-fill)
[![License](https://img.shields.io/npm/l/voice-form-fill)](LICENSE)

[中文文档](./README.zh-CN.md)

## Features

- **🎤 Voice Input** — Built-in Web Speech API (free, Chrome/Edge) + iFlytek ASR (Chinese optimized)
- **🤖 Multi-LLM Support** — DeepSeek, OpenAI, and any OpenAI-compatible API (Ollama, vLLM, etc.)
- **🧩 Pluggable Architecture** — Strategy pattern for LLM/STT adapters, easy to extend
- **📦 Zero Dependencies** — Only Vue 3 as peer dependency, uses native browser APIs
- **🎨 Beautiful UI** — Floating mic button, bottom panel with voice/text tabs, animations
- **⚡ Streaming Response** — Real-time incremental field filling as LLM tokens arrive, with typewriter animation
- **🔌 Framework-Agnostic Core** — Core extraction/filling logic works without Vue
- **📘 Full TypeScript** — Complete type declarations included

## Quick Start

### Installation

```bash
npm install voice-form-fill
```

### Basic Usage

```vue
<template>
  <div>
    <!-- Your form fields here -->
    <input v-model="formData[0].childrenList[0].value" placeholder="Name" />
    <input v-model="formData[0].childrenList[1].value" placeholder="Phone" />

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
      { title: 'Name', componentType: '0', value: '' },
      { title: 'Phone', componentType: '0', value: '' },
    ],
  },
])

function onComplete(result) {
  console.log('Filled:', result.success)
  console.log('Not matched:', result.failed)
}
</script>
```

## Configuration

### LLM Adapters

```vue
<!-- DeepSeek (default) -->
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

<!-- Ollama / Local Models -->
<VoiceFormFill
  llm-adapter="generic"
  api-key=""
  :llm-config="{
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3'
  }"
/>
```

### STT (Speech-to-Text) Adapters

```vue
<!-- Web Speech API (default, free, Chrome/Edge only) -->
<VoiceFormFill stt-adapter="web-speech" />

<!-- iFlytek ASR (Chinese optimized) -->
<VoiceFormFill
  stt-adapter="xunfei"
  :stt-config="{
    xunfei: {
      appId: 'your-xunfei-app-id',
      wsUrl: 'wss://iat-api.xfyun.cn/v2/iat'
    }
  }"
/>

<!-- Text-only mode -->
<VoiceFormFill stt-adapter="none" />
```

## Component API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `formData` | `Record<string, any>[]` | — | Form data array with `childrenList` |
| `apiKey` | `string` | — | LLM API key |
| `title` | `string` | `'Voice Form Fill'` | Panel title |
| `llmAdapter` | `'deepseek' \| 'openai' \| 'generic'` | `'deepseek'` | LLM provider |
| `llmConfig` | `{ baseUrl?, model?, temperature?, maxTokens? }` | — | LLM options |
| `sttAdapter` | `'web-speech' \| 'xunfei' \| 'none'` | `'web-speech'` | Speech-to-text provider |
| `sttConfig` | `object` | — | STT options |
| `textInput` | `boolean` | `true` | Show text input tab |
| `visible` | `boolean` | `false` | Panel visibility (v-model supported) |
| `debug` | `boolean` | `false` | Enable debug logging |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `fill-start` | — | Fill process started |
| `fill-complete` | `{ success: string[], failed: string[] }` | Fill completed |
| `fill-error` | `string` | Error message |
| `field-filled` | `{ label: string, value: unknown }` | Individual field filled |
| `update:visible` | `boolean` | Panel visibility changed |

### Slots

| Slot | Props | Description |
|------|-------|-------------|
| `trigger` | `{ toggle, recording }` | Custom trigger button |
| `header` | `{ title, close }` | Custom panel header |
| `result` | `{ success, failed, loading }` | Custom result display |

### Debug Logging

Enable detailed logs for troubleshooting using the `debug` prop or the `setDebug` API:

```vue
<!-- Component prop -->
<VoiceFormFill :debug="true" ... />
```

```typescript
// Programmatic API
import { setDebug } from 'voice-form-fill'

setDebug(true)  // enable
setDebug(false) // disable (default)
```

All logs are prefixed with `[VoiceFormFill]` and include timing info for LLM calls, STT state changes, field extraction, matching, and filling details. Warnings and errors always print regardless of debug setting.

## Advanced Usage

### Using Composables

```typescript
import { useVoiceFormFill, useSttRecorder, DeepSeekAdapter } from 'voice-form-fill'

const { loading, result, error, execute } = useVoiceFormFill({
  llmAdapter: new DeepSeekAdapter(),
  apiKey: 'sk-xxx',
  formData: () => myFormData,
  onSuccess: (r) => console.log('Filled:', r),
})

// Fill via text
await execute('Name is John, phone is 13800138000')
```

### Using Core (Framework-Agnostic)

```typescript
import { processVoiceFill, DeepSeekAdapter } from 'voice-form-fill'

const result = await processVoiceFill(
  'Name is John, phone is 13800138000',
  childrenList,
  {
    llmAdapter: new DeepSeekAdapter(),
    apiKey: 'sk-xxx',
  }
)
// result: { success: ['Name', 'Phone'], failed: [] }
```

#### Streaming (Real-Time Filling)

```typescript
import { processVoiceFillStream, DeepSeekAdapter } from 'voice-form-fill'

const result = await processVoiceFillStream(
  'Name is John, phone is 13800138000',
  childrenList,
  {
    llmAdapter: new DeepSeekAdapter(),
    apiKey: 'sk-xxx',
  },
  (token) => console.log(token), // raw token callback
  true // enable typewriter animation (default)
)
// Fields fill incrementally as the LLM streams tokens —
// no need to wait for the full response.
```

### Custom LLM Adapter

```typescript
import type { LLMAdapter, LLMCallOptions } from 'voice-form-fill'

class MyCustomAdapter implements LLMAdapter {
  readonly name = 'my-adapter'
  readonly defaultBaseUrl = 'https://my-api.example.com/v1'
  readonly defaultModel = 'my-model'

  async call(options: LLMCallOptions): Promise<Record<string, unknown>> {
    // Your non-streaming implementation here
  }

  async callStream(
    options: LLMCallOptions,
    callbacks: StreamCallbacks
  ): Promise<void> {
    // Your streaming implementation here
    callbacks.onToken?.('partial chunk')
    callbacks.onField?.('label', 'value')
    callbacks.onComplete?.({ /* final mapping */ })
  }
}
```

## Browser Support

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Web Speech API | ✅ | ✅ | ✅ | ❌ |
| iFlytek ASR | ✅ | ✅ | ✅ | ✅ |
| Text Input | ✅ | ✅ | ✅ | ✅ |

## License

MIT
