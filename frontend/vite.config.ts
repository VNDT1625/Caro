import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const repoRoot = path.resolve(__dirname, '..')

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [repoRoot]
    },
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok-free.dev',
      '.ngrok.io'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
