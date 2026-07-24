import {
  BarChart3,
  FileText,
  FolderKanban,
  History,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/types/user'

export interface AppNavigationItem {
  label: string
  path: string
  icon: LucideIcon
  roles: readonly UserRole[]
}

const allRoles: readonly UserRole[] = ['Administrador', 'Coordinador', 'Funcionario', 'Consulta']
const operationalRoles: readonly UserRole[] = ['Administrador', 'Coordinador', 'Funcionario']

export const appNavigation: readonly AppNavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: allRoles },
  { label: 'Mi Agenda', path: '/agenda', icon: ListTodo, roles: operationalRoles },
  { label: 'Expedientes', path: '/expedientes', icon: FolderKanban, roles: allRoles },
  { label: 'Histórico', path: '/historico', icon: History, roles: allRoles },
  { label: 'Radicación', path: '/radicacion', icon: FileText, roles: operationalRoles },
  { label: 'Usuarios', path: '/usuarios', icon: Users, roles: ['Administrador'] },
  { label: 'Reportes', path: '/reportes', icon: BarChart3, roles: ['Administrador', 'Coordinador'] },
  { label: 'Tipos de trámite', path: '/tipos-tramite', icon: FileText, roles: ['Administrador'] },
  { label: 'Configuración', path: '/configuracion', icon: Settings, roles: allRoles },
]

export function getNavigationItem(pathname: string): AppNavigationItem | undefined {
  return appNavigation.find((item) => item.path === pathname)
}
