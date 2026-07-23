import { createHashRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '@/layouts/main-layout'
import { DashboardPage } from '@/pages/dashboard-page'
import { LoginPage } from '@/pages/login-page'

// Hash routing avoids server-side rewrite requirements on GitHub Pages.
export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
    ],
  },
])
