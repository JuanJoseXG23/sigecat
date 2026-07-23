import { Settings } from 'lucide-react'
import { PagePlaceholder } from '@/components/page-placeholder'

export function SettingsPage() {
  return (
    <PagePlaceholder
      eyebrow="Administración"
      title="Configuración"
      description="Aquí podrás administrar los parámetros generales del sistema."
      icon={Settings}
    />
  )
}
