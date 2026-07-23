import { Users } from 'lucide-react'
import { PagePlaceholder } from '@/components/page-placeholder'

export function UsersPage() {
  return (
    <PagePlaceholder
      eyebrow="Administración"
      title="Usuarios"
      description="La administración de usuarios, roles y permisos estará disponible próximamente."
      icon={Users}
    />
  )
}
