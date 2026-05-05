import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5808,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@shell': fileURLToPath(new URL('./shell', import.meta.url)),
      '@modules': fileURLToPath(new URL('./modules', import.meta.url)),
    },
  },
})
