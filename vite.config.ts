import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/sigecat/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Las librerías cambian poco: en archivos aparte el navegador las conserva en caché
        // entre publicaciones y solo descarga de nuevo el código de SIGECAT.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: [
            'react',
            'react-dom',
            'react-dom/client',
            'react-router-dom',
            '@tanstack/react-query',
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
