import { ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'

export function AccessDeniedPage() {
  return (
    <section className="mx-auto max-w-lg pt-10">
      <Card className="p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-destructive">
          <ShieldX size={24} />
        </div>
        <p className="mt-5 text-sm font-medium text-destructive">Acceso restringido</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          No tienes permiso para ver esta página
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Tu rol actual no cuenta con los permisos requeridos. Si crees que se trata de un error,
          comunícate con el administrador del sistema.
        </p>
        <Link
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          to="/dashboard"
        >
          Volver al dashboard
        </Link>
      </Card>
    </section>
  )
}
