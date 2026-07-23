import { FileText } from 'lucide-react'
import { PagePlaceholder } from '@/components/page-placeholder'

export function FilingPage() {
  return (
    <PagePlaceholder
      eyebrow="Gestión documental"
      title="Radicación"
      description="Aquí podrás registrar y dar trazabilidad a la radicación de documentos."
      icon={FileText}
    />
  )
}
