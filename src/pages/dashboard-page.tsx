import { LayoutDashboard } from 'lucide-react'
import { PagePlaceholder } from '@/components/page-placeholder'

export function DashboardPage() {
  return (
    <PagePlaceholder
      eyebrow="Panel principal"
      title="Dashboard"
      description="El panel de indicadores, actividad reciente y alertas estará disponible próximamente."
      icon={LayoutDashboard}
    />
  )
}
