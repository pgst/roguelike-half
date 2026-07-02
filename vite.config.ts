import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: './', // または '/my-app/'
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})