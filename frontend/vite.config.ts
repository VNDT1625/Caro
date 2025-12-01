import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const repoRoot = path.resolve(__dirname, '..')

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [repoRoot]
    }
  }
})
