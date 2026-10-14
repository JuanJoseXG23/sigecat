import { RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState, LoadingState } from '@/components/ui/feedback'
import { isStaleBuildError, reloadForNewVersion } from '@/lib/stale-build'

/**
 * Error al mostrar una página. Si es porque se publicó una versión nueva mientras la pestaña
 * estaba abierta, recarga sola; si no, explica y ofrece recargar.
 */
export function RouteError() {
  const error = useRouteError()
  const stale = isStaleBuildError(error)
  const [reloading, setReloading] = useState(stale)

  useEffect(() => {
    if (stale && !reloadForNewVersion()) setReloading(false)
  }, [stale])

  if (reloading) return <LoadingState label="Hay una versión nueva de SIGECAT. Actualizando…" />
  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <EmptyState
        icon={TriangleAlert}
        title={stale ? 'Hay una versión nueva de SIGECAT' : 'No se pudo mostrar esta página'}
        description={
          stale
            ? 'Se publicó una actualización mientras tenías la aplicación abierta. Recarga para usarla; si sigue apareciendo, espera unos minutos y vuelve a recargar.'
            : 'Recarga la página. Si el problema continúa, avisa al administrador de SIGECAT.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Recargar
            </Button>
            <Button variant="outline" onClick={() => window.location.assign('#/')}>
              Ir al inicio
            </Button>
          </div>
        }
      />
    </div>
  )
}
