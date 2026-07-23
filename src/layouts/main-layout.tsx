import { Building2, LayoutDashboard, Menu, Settings, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navigation = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Expedientes', to: '#', icon: Building2 },
  { label: 'Usuarios', to: '#', icon: Users },
  { label: 'Configuración', to: '#', icon: Settings },
]

export function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-white">
            <Building2 size={19} />
          </div>
          <div>
            <p className="font-semibold text-slate-900">SIGECAT</p>
            <p className="text-xs text-slate-500">Municipio de Girardota</p>
          </div>
        </div>
        <nav className="space-y-1 p-4">
          {navigation.map(({ label, to, icon: Icon }) =>
            to === '#' ? (
              <span
                key={label}
                className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400"
              >
                <Icon size={18} />
                {label}
              </span>
            ) : (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'bg-brand-vitalidad/20 text-primary'
                      : 'text-slate-600 hover:bg-slate-50',
                  )
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ),
          )}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
          <button className="text-slate-600 lg:hidden" aria-label="Abrir navegación">
            <Menu />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">Usuario temporal</p>
              <p className="text-xs text-slate-500">Sin sesión iniciada</p>
            </div>
            <div className="grid size-9 place-items-center rounded-full bg-brand-vitalidad/25 text-sm font-semibold text-primary">
              UT
            </div>
          </div>
        </header>
        <main className="p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
