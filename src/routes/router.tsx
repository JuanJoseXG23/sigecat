import { createHashRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from '@/features/auth/auth-guards'
import { AuthLayout } from '@/layouts/auth-layout'
import { MainLayout } from '@/layouts/main-layout'
import { AccessDeniedPage } from '@/pages/access-denied-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { LoginPage } from '@/pages/login-page'
import { UsersPage } from '@/pages/users-page'

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
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'acceso-denegado', element: <AccessDeniedPage /> },
          {
            path: 'usuarios',
            element: (
              <RoleRoute roles={['Administrador']}>
                <UsersPage />
              </RoleRoute>
            ),
          },
        ],
      },
    ],
  },
])
