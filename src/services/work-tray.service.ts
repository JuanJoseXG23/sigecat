import { listExpedients } from '@/services/expedient.service'
import type { Expedient } from '@/types/expedient'
import type { UserRole } from '@/types/user'

/**
 * El Funcionario ve lo que debe atender: lo que tiene asignado y lo que registró sin
 * responsable. Los demás roles, todo lo activo.
 */
export async function getWorkTray(role: UserRole, uid: string): Promise<Expedient[]> {
  if (role !== 'Funcionario') return listExpedients()
  return (await listExpedients(uid)).filter((item) =>
    item.funcionarioAsignado ? item.funcionarioAsignado.uid === uid : item.creadoPor === uid,
  )
}
