import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'

dotenv.config()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    hmr: {
      overlay: false,
    },
    // Proxy /api requests to the Express backend — eliminates CORS entirely
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path, // keep /api prefix as-is
      },
    },
  },
  define: {
    'process.env': process.env,
  },
})
