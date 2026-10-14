import type { Expedient, ExpedientHistoryEntry } from '@/types/expedient'
import type { UserProfile } from '@/types/user'

/**
 * Notas del historial: aclaraciones libres sobre un expediente ("se confirmó el radicado con la
 * planilla de Archivo"). Quedan en el historial, que es inmutable: una nota no se edita ni se
 * borra; para corregirla se agrega otra. Las reglas (`isValidNote` en firestore.rules) repiten
 * estos límites.
 */
export const NOTE_ACTION = 'Nota'
export const MIN_NOTE_LENGTH = 5
export const MAX_NOTE_LENGTH = 1000

/** Error de la nota, o null si se puede guardar. */
export function getNoteError(text: string): string | null {
  const value = text.trim()
  if (value.length < MIN_NOTE_LENGTH)
    return `Escribe la nota (al menos ${MIN_NOTE_LENGTH} caracteres).`
  if (value.length > MAX_NOTE_LENGTH) return `La nota admite hasta ${MAX_NOTE_LENGTH} caracteres.`
  return null
}

/**
 * Refleja la creación de notas en firestore.rules. Escriben notas Administrador y Coordinador
 * en cualquier expediente, y el Funcionario en los que figura en `participantes`, aunque ya no
 * los gestione, también cerrados. Directivo y Consulta no escriben.
 */
export function canAddNote(
  profile: Pick<UserProfile, 'uid' | 'rol'> | null,
  expedient: Pick<Expedient, 'participantes'>,
): boolean {
  if (profile?.rol === 'Administrador' || profile?.rol === 'Coordinador') return true
  return profile?.rol === 'Funcionario' && (expedient.participantes ?? []).includes(profile.uid)
}

export function isNote(entry: Pick<ExpedientHistoryEntry, 'accion'>): boolean {
  return entry.accion === NOTE_ACTION
}
