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

/** Roles que ven el Panel de dirección y pueden preguntar a los responsables por correo. */
export const MANAGEMENT_ROLES = ['Administrador', 'Coordinador', 'Directivo'] as const

/** Refleja canAskAboutExpedient de firestore.rules. */
export function canAskAboutExpedients(profile: Actor): boolean {
  return MANAGEMENT_ROLES.some((role) => role === profile?.rol)
}

/** Página de inicio: la jefatura entra a su panel; los demás, a la bandeja de trabajo. */
export function getHomePath(profile: Actor): string {
  return profile?.rol === 'Directivo' ? '/direccion' : '/dashboard'
}

/** Corregir radicados y documentos ya registrados es tarea de Administrador y Coordinador. */
export function canCorrectRecords(profile: Actor): boolean {
  return isSupervisor(profile)
}
