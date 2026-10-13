import {
  Archive,
  BarChart3,
  FileCog,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Library,
  ListTodo,
  Settings,
  Stamp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/types/user'

export type NavigationGroup = 'Gestión' | 'Archivo' | 'Administración'

export interface AppNavigationItem {
  label: string
  path: string
  icon: LucideIcon
  roles: readonly UserRole[]
  group: NavigationGroup
}

const allRoles: readonly UserRole[] = [
  'Administrador',
  'Coordinador',
  'Funcionario',
  'Directivo',
  'Consulta',
]
const operationalRoles: readonly UserRole[] = ['Administrador', 'Coordinador', 'Funcionario']
const managementRoles: readonly UserRole[] = ['Administrador', 'Coordinador', 'Directivo']

export const navigationGroups: readonly NavigationGroup[] = ['Gestión', 'Archivo', 'Administración']

export const appNavigation: readonly AppNavigationItem[] = [
  {
    label: 'Panel de dirección',
    path: '/direccion',
    icon: Gauge,
    roles: managementRoles,
    group: 'Gestión',
  },
  {
    label: 'Bandeja de trabajo',
    path: '/dashboard',
    icon: LayoutDashboard,
    roles: ['Administrador', 'Coordinador', 'Funcionario', 'Consulta'],
    group: 'Gestión',
  },
  {
    label: 'Expedientes',
    path: '/expedientes',
    icon: FolderKanban,
    roles: allRoles,
    group: 'Gestión',
  },
  {
    label: 'Radicación',
    path: '/radicacion',
    icon: Stamp,
    roles: [...operationalRoles, 'Directivo'],
    group: 'Gestión',
  },
  {
    label: 'Mi agenda',
    path: '/agenda',
    icon: ListTodo,
    roles: operationalRoles,
    group: 'Gestión',
  },
  {
    label: 'Biblioteca de documentos',
    path: '/documentos',
    icon: Library,
    roles: allRoles,
    group: 'Archivo',
  },
  {
    label: 'Histórico',
    path: '/historico',
    icon: Archive,
    roles: allRoles,
    group: 'Archivo',
  },
  {
    label: 'Reportes',
    path: '/reportes',
    icon: BarChart3,
    roles: managementRoles,
    group: 'Administración',
  },
  {
    label: 'Usuarios',
    path: '/usuarios',
    icon: Users,
    roles: ['Administrador'],
    group: 'Administración',
  },
  {
    label: 'Tipos de trámite',
    path: '/tipos-tramite',
    icon: FileCog,
    roles: ['Administrador'],
    group: 'Administración',
  },
  {
    label: 'Configuración',
    path: '/configuracion',
    icon: Settings,
    roles: ['Administrador'],
    group: 'Administración',
  },
]

export function getNavigationItem(pathname: string): AppNavigationItem | undefined {
  return appNavigation.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  )
}
