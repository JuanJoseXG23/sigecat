import { ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button-variants'
import { EmptyState } from '@/components/ui/feedback'

export function AccessDeniedPage() {
  return (
    <section className="mx-auto max-w-lg pt-10">
      <div className="table-shell">
        <EmptyState
          icon={ShieldX}
          title="No tienes permiso para ver esta página"
          description="Tu rol no incluye esta sección. Si crees que es un error, comunícate con el administrador de SIGECAT."
          action={
            <Link className={buttonVariants()} to="/dashboard">
              Volver a la bandeja
            </Link>
          }
        />
      </div>
    </section>
  )
}
