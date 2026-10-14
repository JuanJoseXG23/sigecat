import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/app'
import '@/styles/globals.css'
import { reloadForNewVersion } from '@/lib/stale-build'

// Vite avisa cuando no encuentra un archivo de la versión anterior (se publicó una nueva con la
// pestaña abierta): se recarga para traer la nueva. Mientras tanto, o si ya se recargó hace poco,
// la pantalla de error de la ruta explica qué pasa.
window.addEventListener('vite:preloadError', () => reloadForNewVersion())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
