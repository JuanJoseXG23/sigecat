import type { Expedient } from '@/types/expedient'
import type { UserProfile } from '@/types/user'

type Actor = Pick<UserProfile, 'uid' | 'rol'> | null

/** Administrador y Coordinador supervisan todos los expedientes. */
export function isSupervisor(profile: Actor): boolean {
  return profile?.rol === 'Administrador' || profile?.rol === 'Coordinador'
}

/**
 * Refleja canReadAll de firestore.rules. Los demás (el Funcionario) solo ven los expedientes
 * donde figuran en `participantes`, y sus consultas deben pedir exactamente eso.
 */
export function canReadAllExpedients(profile: Actor): boolean {
  return (
    profile?.rol === 'Administrador' ||
    profile?.rol === 'Coordinador' ||
    profile?.rol === 'Directivo' ||
    profile?.rol === 'Consulta'
  )
}

/** uid con el que se filtran las consultas de quien no ve todo; undefined si ve todo. */
export function getParticipantScope(profile: Actor): string | undefined {
  return profile && !canReadAllExpedients(profile) ? profile.uid : undefined
}

/**
 * Refleja canManageExpedient de firestore.rules; si cambia una, debe cambiar la otra.
 * Un Funcionario gestiona los expedientes activos que tiene asignados, o los que registró
 * mientras no tengan responsable; quien lo tuvo antes solo lo consulta. Los finalizados solo
 * los corrigen el Administrador y el Coordinador.
 */
export function canManageExpedient(
  profile: Actor,
  expedient: Pick<Expedient, 'funcionarioAsignado' | 'activo'> &
    Partial<Pick<Expedient, 'creadoPor'>>,
): boolean {
  if (!profile) return false
  if (!expedient.activo) return isSupervisor(profile)
  if (isSupervisor(profile)) return true
  if (profile.rol !== 'Funcionario') return false
  return expedient.funcionarioAsignado
    ? expedient.funcionarioAsignado.uid === profile.uid
    : expedient.creadoPor === profile.uid
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
