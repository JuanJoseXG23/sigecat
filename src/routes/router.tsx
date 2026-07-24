import { createHashRouter, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from '@/features/auth/auth-guards'
import { AuthLayout } from '@/layouts/auth-layout'
import { MainLayout } from '@/layouts/main-layout'
import { AccessDeniedPage } from '@/pages/access-denied-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { ExpedientsPage } from '@/pages/expedients-page'
import { ExpedientDetailPage } from '@/pages/expedient-detail-page'
import { FilingPage } from '@/pages/filing-page'
import { LoginPage } from '@/pages/login-page'
import { ReportsPage } from '@/pages/reports-page'
import { ProcedureTypesPage } from '@/pages/procedure-types-page'
import { SettingsPage } from '@/pages/settings-page'
import { UsersPage } from '@/pages/users-page'
import { appNavigation } from '@/routes/navigation'

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
          { path: 'expedientes', element: withRole('/expedientes', <ExpedientsPage />) },
          { path: 'expedientes/:id', element: withRole('/expedientes', <ExpedientDetailPage />) },
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
