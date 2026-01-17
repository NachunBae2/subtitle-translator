import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  base: './', // Electron 로컬 파일 로드용
  server: {
    port: 3003,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'chrome120',
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
  },
})
