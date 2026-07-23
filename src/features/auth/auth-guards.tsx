import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import type { UserRole } from '@/types/user'

function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
      Cargando sesión…
    </div>
  )
}

export function ProtectedRoute() {
  const { status } = useAuth()

  if (status === 'loading') return <FullPageLoader />
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />
}

export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'loading') return <FullPageLoader />
  return status === 'authenticated' ? <Navigate to="/dashboard" replace /> : <Outlet />
}

export function RoleRoute({
  roles,
  children,
}: {
  roles: readonly UserRole[]
  children: React.ReactNode
}) {
  const { hasRole } = useAuth()
  return hasRole(roles) ? children : <Navigate to="/acceso-denegado" replace />
}
