import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/geo': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/users': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three:   ['three'],
          leaflet: ['leaflet', 'react-leaflet'],
          react:   ['react', 'react-dom'],
        }
      }
    }
  }
})
