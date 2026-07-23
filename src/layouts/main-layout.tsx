import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { appNavigation, getNavigationItem } from '@/routes/navigation'
import shield from '@/img/Escudo_de_Girardota.webp'

interface NavigationProps {
  collapsed?: boolean
  onNavigate?: () => void
}

function SideNavigation({ collapsed = false, onNavigate }: NavigationProps) {
  const { hasRole } = useAuth()

  return (
    <nav className="space-y-1 p-3" aria-label="Navegación principal">
      {appNavigation
        .filter((item) => hasRole(item.roles))
        .map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            title={collapsed ? label : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                collapsed ? 'justify-center' : 'gap-3',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
              )
            }
          >
            <Icon size={18} aria-hidden="true" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
    </nav>
  )
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-20 items-center border-b border-slate-200',
        collapsed ? 'justify-center px-3' : 'gap-3 px-5',
      )}
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
        <img
          src={shield}
          alt="Escudo del Municipio de Girardota"
          className="size-full object-contain drop-shadow-sm"
        />
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="font-semibold tracking-tight text-slate-900">SIGECAT</p>
          <p className="truncate text-xs text-slate-500">Municipio de Girardota</p>
        </div>
      )}
    </div>
  )
}

export function MainLayout() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentItem = getNavigationItem(pathname)
  const initial = profile?.nombreCompleto.charAt(0).toUpperCase() ?? 'U'

  const breadcrumbs = currentItem ? ['Inicio', currentItem.label] : ['Inicio', 'Acceso denegado']

  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white transition-[width] duration-200 lg:block',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <Brand collapsed={collapsed} />
        <SideNavigation collapsed={collapsed} />
        <div className="absolute inset-x-0 bottom-5 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </Button>
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar navegación"
              className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white shadow-xl lg:hidden"
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between">
                <Brand />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-3"
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Cerrar navegación"
                >
                  <X size={18} />
                </Button>
              </div>
              <SideNavigation onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-20' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir navegación"
              aria-expanded={mobileOpen}
            >
              <Menu size={20} />
            </Button>
            <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="Migas de pan">
              {breadcrumbs.map((breadcrumb, index) => (
                <span key={breadcrumb} className="flex items-center gap-2">
                  {index > 0 && <span className="text-slate-300">/</span>}
                  <span className={cn(index === breadcrumbs.length - 1 ? 'truncate font-medium text-slate-800' : 'hidden text-slate-500 sm:inline')}>
                    {breadcrumb}
                  </span>
                </span>
              ))}
            </nav>
          </div>

          <details className="relative ml-3 shrink-0">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1 text-left outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-ring">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-800">{profile?.nombreCompleto}</p>
                <p className="text-xs text-slate-500">{profile?.cargo} · {profile?.rol}</p>
              </div>
              <Avatar aria-label={`Usuario: ${profile?.nombreCompleto ?? 'sin nombre'}`}>{initial}</Avatar>
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2 sm:hidden">
                <p className="text-sm font-medium text-slate-800">{profile?.nombreCompleto}</p>
                <p className="mt-0.5 text-xs text-slate-500">{profile?.cargo} · {profile?.rol}</p>
              </div>
              <button
                className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-destructive"
                type="button"
                onClick={() => void signOut()}
              >
                <LogOut size={16} aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          </details>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
