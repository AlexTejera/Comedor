import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // OJO: NO usar base relativa ('./') acá — con un SPA de rutas anidadas
  // (ej. /admin/botoneras) un link profundo cargado directo (F5, bookmark)
  // resolvería "./assets/x.js" contra el path actual y pediría un 404
  // (ej. /admin/assets/x.js en vez de /assets/x.js). Se deja base absoluta
  // (comportamiento por defecto) y el backend reescribe el puñado de rutas
  // "/assets/..." de index.html al vuelo según el prefijo del WAF de esta
  // request puntual — ver serve_spa() en backend/app/main.py.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
