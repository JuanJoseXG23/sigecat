/**
 * Clase de correspondencia del expediente. La externa la radica Archivo (2026100xxxx); la
 * interna llega de otra oficina de la Alcaldía con su propia numeración (2026-xxxxxx). Los
 * expedientes anteriores a este campo son externos.
 */
export const CORRESPONDENCE_CLASSES = ['Externa', 'Interna'] as const

export type CorrespondenceClass = (typeof CORRESPONDENCE_CLASSES)[number]

export function getCorrespondenceClass(item: { clase?: string }): CorrespondenceClass {
  return item.clase === 'Interna' ? 'Interna' : 'Externa'
}

/** Clase que sugiere el formato del número: con guion, interna; solo dígitos, externa. */
export function detectCorrespondenceClass(number: string): CorrespondenceClass | undefined {
  const value = number.trim()
  if (/^\d{4}-/.test(value)) return 'Interna'
  if (/^\d+$/.test(value)) return 'Externa'
  return undefined
}

/** Si el expediente es de la clase elegida; sin clase elegida, todos coinciden. */
export function matchesCorrespondence(
  item: { clase?: string },
  filter: '' | CorrespondenceClass,
): boolean {
  return !filter || getCorrespondenceClass(item) === filter
}
