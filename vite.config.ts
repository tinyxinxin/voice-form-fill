import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      include: ['src'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'demo'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VoiceFormFill',
      formats: ['es', 'umd'],
      fileName: (format) => {
        if (format === 'es') return 'voice-form-fill.js'
        if (format === 'umd') return 'voice-form-fill.umd.cjs'
        return `voice-form-fill.${format}.js`
      },
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css'
          return assetInfo.name ?? 'assets/[name].[hash][extname]'
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: 'esbuild',
  },
})
