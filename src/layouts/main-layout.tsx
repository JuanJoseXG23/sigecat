import { ChevronsLeft, ChevronsRight, LogOut, Menu, Search, X } from 'lucide-react'
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { LoadingState } from '@/components/ui/feedback'
import { useAuth } from '@/hooks/use-auth'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { appNavigation, getNavigationItem, navigationGroups } from '@/routes/navigation'
import shield from '@/img/Escudo_de_Girardota.webp'

const COLLAPSED_KEY = 'sigecat:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

interface NavigationProps {
  collapsed?: boolean
  onNavigate?: () => void
}

function SideNavigation({ collapsed = false, onNavigate }: NavigationProps) {
  const { hasRole } = useAuth()
  const items = appNavigation.filter((item) => hasRole(item.roles))

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
      {navigationGroups.map((group) => {
        const groupItems = items.filter((item) => item.group === group)
        if (!groupItems.length) return null
        return (
          <div key={group}>
            {collapsed ? (
              <div className="mx-3 mb-2 border-t border-white/10" aria-hidden="true" />
            ) : (
              <p className="mb-1.5 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/40">
                {group}
              </p>
            )}
            <div className="space-y-0.5">
              {groupItems.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  title={collapsed ? label : undefined}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      collapsed ? 'justify-center' : 'gap-3',
                      isActive
                        ? 'bg-white/[0.12] text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-brand-juventud'
                        : 'text-white/70 hover:bg-white/[0.06] hover:text-white',
                    )
                  }
                >
                  <Icon size={18} aria-hidden="true" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-[4.5rem] shrink-0 items-center border-b border-white/10',
        collapsed ? 'justify-center px-2' : 'gap-3 px-5',
      )}
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white p-1 shadow-sm">
        <img
          src={shield}
          alt="Escudo del Municipio de Girardota"
          className="size-full object-contain"
        />
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="text-[1.05rem] font-bold tracking-wide text-white">SIGECAT</p>
          <p className="truncate text-xs text-white/60">Alcaldía de Girardota</p>
        </div>
      )}
    </div>
  )
}

/** Busca por radicado o solicitante desde cualquier pantalla; "/" pone el foco aquí. */
function GlobalSearch() {
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== '/' || target.closest('input, textarea, select, [contenteditable]')) return
      event.preventDefault()
      input.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const query = value.trim()
    if (!query) return
    navigate(`/expedientes?q=${encodeURIComponent(query)}`)
    setValue('')
    input.current?.blur()
  }

  return (
    <form onSubmit={submit} role="search" className="relative hidden w-full max-w-sm md:block">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        ref={input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar radicado, solicitante o predio…"
        aria-label="Buscar expedientes"
        className="h-10 w-full rounded-lg border border-border bg-muted/50 pl-9 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-white px-1.5 text-[0.7rem] text-slate-400">
        /
      </kbd>
    </form>
  )
}

function UserMenu() {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={container} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-slate-100"
      >
        <div className="hidden text-right sm:block">
          <p className="max-w-48 truncate text-sm font-semibold text-slate-800">
            {profile?.nombreCompleto}
          </p>
          <p className="text-xs text-muted-foreground">{profile?.rol}</p>
        </div>
        <Avatar aria-hidden="true" className="bg-primary text-white">
          {initials(profile?.nombreCompleto)}
        </Avatar>
      </button>
      {open && (
        <div
          role="menu"
          className="animate-fade-in absolute right-0 mt-2 w-72 rounded-xl border border-border bg-white p-2 shadow-xl shadow-slate-900/10"
        >
          <div className="border-b border-border px-3 pb-3 pt-2">
            <p className="font-semibold text-slate-900">{profile?.nombreCompleto}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{profile?.correo}</p>
            <p className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {profile?.cargo} · {profile?.rol}
            </p>
          </div>
          <button
            role="menuitem"
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-destructive"
            type="button"
            onClick={() => void signOut()}
          >
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export function MainLayout() {
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentItem = getNavigationItem(pathname)

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(!value))
      } catch {
        // Sin almacenamiento local la preferencia dura solo esta sesión.
      }
      return !value
    })
  }

  useEffect(() => {
    document.title = currentItem ? `${currentItem.label} · SIGECAT` : 'SIGECAT · Girardota'
  }, [currentItem])

  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="sr-only z-[90] rounded-md bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[4.75rem]' : 'w-64',
        )}
      >
        <div className="flag-stripe h-1 shrink-0" aria-hidden="true" />
        <Brand collapsed={collapsed} />
        <SideNavigation collapsed={collapsed} />
        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'flex w-full items-center rounded-lg px-3 py-2 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white',
              collapsed ? 'justify-center' : 'gap-3',
            )}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            {!collapsed && 'Contraer menú'}
          </button>
        </div>
      </aside>

      {/* Siempre montado para animar con CSS; `inert` lo saca del foco cuando está cerrado. */}
      <div className={cn('lg:hidden', !mobileOpen && 'pointer-events-none')} inert={!mobileOpen}>
        <button
          type="button"
          aria-label="Cerrar navegación"
          className={cn(
            'fixed inset-0 z-40 bg-slate-950/45 transition-opacity duration-200',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar shadow-xl transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flag-stripe h-1 shrink-0" aria-hidden="true" />
          <div className="flex items-center justify-between pr-3">
            <Brand />
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar navegación"
            >
              <X size={18} />
            </button>
          </div>
          <SideNavigation onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>

      <div
        className={cn(
          'transition-[padding] duration-200',
          collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-64',
        )}
      >
        <header
          data-app-header
          className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8"
        >
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegación"
            aria-expanded={mobileOpen}
          >
            <Menu size={20} />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold text-slate-800 md:hidden">
            {currentItem?.label ?? 'SIGECAT'}
          </p>
          <GlobalSearch />
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>
        <main id="contenido" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<LoadingState />}>
            <div key={pathname} className="animate-fade-up">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
