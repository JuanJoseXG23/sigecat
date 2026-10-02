import { createHashRouter, Navigate } from 'react-router-dom'
import { lazy, type ReactNode } from 'react'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from '@/features/auth/auth-guards'
import { AuthLayout } from '@/layouts/auth-layout'
import { MainLayout } from '@/layouts/main-layout'
import { appNavigation } from '@/routes/navigation'
import { AccessDeniedPage } from '@/pages/access-denied-page'

// Cada página se descarga al visitarla por primera vez. Así la sesión ya iniciada no carga
// el formulario de login, y nadie descarga las páginas que su rol no puede ver.
const LoginPage = lazy(() =>
  import('@/pages/login-page').then((module) => ({ default: module.LoginPage })),
)
const DashboardPage = lazy(() =>
  import('@/pages/dashboard-page').then((module) => ({ default: module.DashboardPage })),
)
const AgendaPage = lazy(() =>
  import('@/pages/agenda-page').then((module) => ({ default: module.AgendaPage })),
)
const ExpedientsPage = lazy(() =>
  import('@/pages/expedients-page').then((module) => ({ default: module.ExpedientsPage })),
)
const ExpedientDetailPage = lazy(() =>
  import('@/pages/expedient-detail-page').then((module) => ({
    default: module.ExpedientDetailPage,
  })),
)
const HistoricalPage = lazy(() =>
  import('@/pages/historical-page').then((module) => ({ default: module.HistoricalPage })),
)
const FilingPage = lazy(() =>
  import('@/pages/filing-page').then((module) => ({ default: module.FilingPage })),
)
const ReportsPage = lazy(() =>
  import('@/pages/reports-page').then((module) => ({ default: module.ReportsPage })),
)
const ProcedureTypesPage = lazy(() =>
  import('@/pages/procedure-types-page').then((module) => ({ default: module.ProcedureTypesPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/settings-page').then((module) => ({ default: module.SettingsPage })),
)
const UsersPage = lazy(() =>
  import('@/pages/users-page').then((module) => ({ default: module.UsersPage })),
)
const DocumentsLibraryPage = lazy(() =>
  import('@/pages/documents-library-page').then((module) => ({
    default: module.DocumentsLibraryPage,
  })),
)

const navigationByPath = Object.fromEntries(appNavigation.map((item) => [item.path, item]))

function withRole(path: keyof typeof navigationByPath, page: ReactNode) {
  return <RoleRoute roles={navigationByPath[path].roles}>{page}</RoleRoute>
}

// Hash routing avoids server-side rewrite requirements on GitHub Pages.
export const router = createHashRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: '/login',
        element: <AuthLayout />,
        children: [{ index: true, element: <LoginPage /> }],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: withRole('/dashboard', <DashboardPage />) },
          { path: 'agenda', element: withRole('/agenda', <AgendaPage />) },
          { path: 'expedientes', element: withRole('/expedientes', <ExpedientsPage />) },
          { path: 'expedientes/:id', element: withRole('/expedientes', <ExpedientDetailPage />) },
          { path: 'documentos', element: withRole('/documentos', <DocumentsLibraryPage />) },
          { path: 'historico', element: withRole('/historico', <HistoricalPage />) },
          { path: 'radicacion', element: withRole('/radicacion', <FilingPage />) },
          { path: 'usuarios', element: withRole('/usuarios', <UsersPage />) },
          { path: 'reportes', element: withRole('/reportes', <ReportsPage />) },
          { path: 'tipos-tramite', element: withRole('/tipos-tramite', <ProcedureTypesPage />) },
          { path: 'configuracion', element: withRole('/configuracion', <SettingsPage />) },
          { path: 'acceso-denegado', element: <AccessDeniedPage /> },
          { path: '*', element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
])
