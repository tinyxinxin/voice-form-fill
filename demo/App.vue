<template>
  <div class="demo-app">
    <h1>VoiceFormFill Demo</h1>
    <p class="demo-desc">
      A floating mic button will appear at the bottom-right corner.
      Click it to try voice or text form filling.
    </p>

    <!-- 模拟表单 -->
    <div class="demo-form">
      <div class="form-group">
        <label>Name</label>
        <input v-model="formData[0].childrenList[0].value" placeholder="Name" />
      </div>
      <div class="form-group">
        <label>Gender</label>
        <select v-model="formData[0].childrenList[1].value">
          <option value="">Select</option>
          <option>Male</option>
          <option>Female</option>
        </select>
      </div>
      <div class="form-group">
        <label>ID Number</label>
        <input v-model="formData[0].childrenList[2].value" placeholder="ID Number" />
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input v-model="formData[0].childrenList[3].value" placeholder="Phone" />
      </div>
      <div class="form-group">
        <label>Address</label>
        <input v-model="formData[0].childrenList[4].value" placeholder="Address" />
      </div>
    </div>

    <VoiceFormFill
      :debug="true"
      :form-data="formData"
      :api-key="apiKey"
      title="Voice Form Fill"
      llm-adapter="deepseek"
      :stt-adapter="'web-speech'"
      text-input
      @fill-complete="onComplete"
      @fill-error="onError"
    />

    <div v-if="lastResult" class="result-info">
      <h3>Last Fill Result</h3>
      <div>Success: {{ lastResult.success.join(', ') || '(none)' }}</div>
      <div>Failed: {{ lastResult.failed.join(', ') || '(none)' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import VoiceFormFill from '../src/components/VoiceFormFill.vue'

const apiKey = ref(
  import.meta.env.VITE_DEEPSEEK_API_KEY || ''
)

const formData = ref([
  {
    childrenList: [
      { title: 'Name', componentType: '0', value: '' },
      {
        title: 'Gender',
        componentType: '1',
        value: '',
        childrenList: [
          { title: 'Male', name: 'Male' },
          { title: 'Female', name: 'Female' },
        ],
      },
      { title: 'ID Number', componentType: '0', value: '' },
      { title: 'Phone', componentType: '0', value: '' },
      { title: 'Address', componentType: '0', value: '' },
    ],
  },
])

const lastResult = ref<{ success: string[]; failed: string[] } | null>(null)

function onComplete(r: { success: string[]; failed: string[] }) {
  console.log('Fill complete:', r)
  lastResult.value = r
}

function onError(msg: string) {
  console.error('Fill error:', msg)
}
</script>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f5f6f7;
}

.demo-app {
  max-width: 420px;
  margin: 0 auto;
  padding: 20px;
  padding-bottom: 200px;
}

.demo-app h1 {
  font-size: 20px;
  color: #323233;
  margin-bottom: 4px;
}

.demo-desc {
  font-size: 13px;
  color: #969799;
  margin-bottom: 20px;
}

.demo-form {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #646566;
  margin-bottom: 4px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dcdee0;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
  font-family: inherit;
}

.result-info {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  font-size: 13px;
}

.result-info h3 {
  margin: 0 0 8px;
  font-size: 15px;
}
</style>
