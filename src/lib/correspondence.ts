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

/**
 * Clase a la que conviene cambiar mientras se escribe el número: solo el guion la decide (el
 * formato interno es exclusivo). Los dígitos solos no cambian nada, porque el año de un número
 * interno también empieza así.
 */
export function suggestCorrespondenceClass(number: string): 'Interna' | undefined {
  return detectCorrespondenceClass(number) === 'Interna' ? 'Interna' : undefined
}

/** Si el expediente es de la clase elegida; sin clase elegida, todos coinciden. */
export function matchesCorrespondence(
  item: { clase?: string },
  filter: '' | CorrespondenceClass,
): boolean {
  return !filter || getCorrespondenceClass(item) === filter
}
