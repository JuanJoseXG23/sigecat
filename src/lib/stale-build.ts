/**
 * Cada publicación cambia el nombre de los archivos de las páginas (`historical-page-XXXX.js`)
 * y borra los anteriores. Una pestaña abierta desde antes sigue pidiendo los viejos y falla al
 * entrar a una sección que no había abierto. Se resuelve recargando para traer la versión nueva.
 */

const RELOAD_KEY = 'sigecat:recarga-por-version'
/** Si ya se recargó hace menos de esto, no se insiste: se evita un ciclo de recargas. */
const RELOAD_COOLDOWN_MS = 30_000

// Mensajes de Chrome/Edge, Firefox y Safari, y el de Vite al precargar estilos.
const STALE_BUILD_MESSAGES = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'Unable to preload CSS',
]

export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return STALE_BUILD_MESSAGES.some((text) => message.includes(text))
}

/** Recarga la página salvo que ya se haya hecho hace poco; devuelve si recargó. */
export function reloadForNewVersion(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.sessionStorage,
  reload: () => void = () => window.location.reload(),
  now = Date.now(),
): boolean {
  try {
    const last = Number(storage?.getItem(RELOAD_KEY) ?? 0)
    if (now - last < RELOAD_COOLDOWN_MS) return false
    storage?.setItem(RELOAD_KEY, String(now))
  } catch {
    // Sin almacenamiento (navegación privada estricta) igual se recarga una vez.
  }
  reload()
  return true
}
