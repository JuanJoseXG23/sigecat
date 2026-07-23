import { listExpedients } from '@/services/expedient.service'
import type { Expedient } from '@/types/expedient'
import type { UserRole } from '@/types/user'

export async function getWorkTray(role: UserRole, uid: string): Promise<Expedient[]> {
  const expedients = await listExpedients()
  return role === 'Funcionario'
    ? expedients.filter((item) => item.funcionarioAsignado?.uid === uid)
    : expedients
}
