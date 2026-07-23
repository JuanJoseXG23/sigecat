import { BarChart3 } from 'lucide-react'
import { PagePlaceholder } from '@/components/page-placeholder'

export function ReportsPage() {
  return (
    <PagePlaceholder
      eyebrow="Análisis"
      title="Reportes"
      description="Aquí estarán disponibles los indicadores y reportes de la gestión documental."
      icon={BarChart3}
    />
  )
}
