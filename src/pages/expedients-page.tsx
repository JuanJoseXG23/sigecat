import { FolderKanban } from 'lucide-react'
import { PagePlaceholder } from '@/components/page-placeholder'

export function ExpedientsPage() {
  return (
    <PagePlaceholder
      eyebrow="Gestión documental"
      title="Expedientes"
      description="Aquí podrás consultar y gestionar los expedientes documentales autorizados."
      icon={FolderKanban}
    />
  )
}
