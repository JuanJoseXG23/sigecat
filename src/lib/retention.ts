/**
 * Tiempos de retención de la Tabla de Retención Documental (TRD), contados desde el cierre del
 * expediente: primero en el archivo de gestión, luego en el archivo central (transferencia
 * primaria) y al final se aplica la disposición final.
 */

export type RetentionPhase =
  'Sin TRD' | 'En archivo de gestión' | 'Listo para transferencia' | 'Aplicar disposición final'

export interface RetentionStatus {
  phase: RetentionPhase
  /** Desde cuándo puede ir al archivo central. */
  transferDate?: Date
  /** Desde cuándo se puede aplicar la disposición final. */
  dispositionDate?: Date
}

function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate())
}

export function getRetentionStatus(
  closingDate: Date,
  managementYears: number | undefined,
  centralYears: number | undefined,
  today = new Date(),
): RetentionStatus {
  if (managementYears === undefined) return { phase: 'Sin TRD' }
  const transferDate = addYears(closingDate, managementYears)
  const dispositionDate =
    centralYears === undefined ? undefined : addYears(transferDate, centralYears)
  const phase: RetentionPhase =
    dispositionDate && today >= dispositionDate
      ? 'Aplicar disposición final'
      : today >= transferDate
        ? 'Listo para transferencia'
        : 'En archivo de gestión'
  return { phase, transferDate, dispositionDate }
}
