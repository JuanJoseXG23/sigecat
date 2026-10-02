import type { Expedient } from '@/types/expedient'
import type { UserProfile } from '@/types/user'

type Actor = Pick<UserProfile, 'uid' | 'rol'> | null

/** Administrador y Coordinador supervisan todos los expedientes. */
export function isSupervisor(profile: Actor): boolean {
  return profile?.rol === 'Administrador' || profile?.rol === 'Coordinador'
}

/**
 * Refleja canManageExpedient de firestore.rules; si cambia una, debe cambiar la otra.
 * Un Funcionario solo gestiona expedientes sin asignar o asignados a él, y los
 * expedientes finalizados solo los corrigen el Administrador y el Coordinador.
 */
export function canManageExpedient(
  profile: Actor,
  expedient: Pick<Expedient, 'funcionarioAsignado' | 'activo'>,
): boolean {
  if (!profile) return false
  if (!expedient.activo) return isSupervisor(profile)
  if (isSupervisor(profile)) return true
  return (
    profile.rol === 'Funcionario' &&
    (!expedient.funcionarioAsignado || expedient.funcionarioAsignado.uid === profile.uid)
  )
}

/** Corregir radicados y documentos ya registrados es tarea de Administrador y Coordinador. */
export function canCorrectRecords(profile: Actor): boolean {
  return isSupervisor(profile)
}
