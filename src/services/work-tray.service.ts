import { listExpedients } from '@/services/expedient.service'
import type { Expedient } from '@/types/expedient'
import type { UserRole } from '@/types/user'

/** El Funcionario ve solo lo que tiene asignado; los demás roles, todo lo activo. */
export function getWorkTray(role: UserRole, uid: string): Promise<Expedient[]> {
  return listExpedients(role === 'Funcionario' ? uid : undefined)
}
