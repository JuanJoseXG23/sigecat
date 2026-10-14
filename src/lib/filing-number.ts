/**
 * Archivo asigna todos los radicados con la estructura año + serie + consecutivo:
 * `100` para lo que entra (2026100xxxx) y `200` para todo lo que se envía, incluidos traslados y
 * ampliaciones de plazo (2026200xxxx). El consecutivo tiene 4 cifras; se aceptan más para no
 * bloquear la aplicación si Archivo pasa de 9.999 en un año.
 *
 * Se valida solo lo que se escribe o corrige: los radicados históricos con otro formato se
 * conservan mientras no se cambien.
 */

export type FilingDirection = 'entrada' | 'salida'

const SERIES: Record<FilingDirection, string> = { entrada: '100', salida: '200' }

/** Error del número de radicado, o null si es válido para su sentido y su fecha (yyyy-mm-dd). */
export function getFilingNumberError(
  number: string,
  date: string,
  direction: FilingDirection,
): string | null {
  const value = number.trim()
  const series = SERIES[direction]
  const year = date ? date.slice(0, 4) : String(new Date().getFullYear())
  const match = /^(\d{4})(\d{3})(\d{4,})$/.exec(value)
  if (!match)
    return `El radicado debe tener solo números: año, serie ${series} y consecutivo (ej. ${year}${series}0001).`
  const [, filingYear, filingSeries] = match
  if (filingSeries !== series) {
    if (filingSeries === SERIES.salida)
      return 'Ese número es un radicado de salida (serie 200); el de entrada usa la serie 100.'
    if (filingSeries === SERIES.entrada)
      return 'Ese número es un radicado de entrada (serie 100); lo que se envía usa la serie 200.'
    return `La serie del radicado debe ser ${series} (ej. ${year}${series}0001).`
  }
  if (date && filingYear !== year)
    return `El radicado empieza por ${filingYear}, pero su fecha es de ${year}.`
  return null
}
