import { Building2 } from 'lucide-react'
import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary text-white">
            <Building2 />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">SIGECAT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistema Integral de Gestión Catastral Documental
          </p>
        </div>
        <Outlet />
        <p className="mt-6 text-center text-xs text-slate-400">
          Municipio de Girardota · Secretaría de Hacienda y Desarrollo Económico
        </p>
      </div>
    </main>
  )
}
