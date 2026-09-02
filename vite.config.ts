import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/MNM-goal-tracker/',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: true },
})
