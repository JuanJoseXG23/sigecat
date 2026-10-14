/**
 * Las listas de archivo (Histórico, Reportes, Biblioteca, Radicación) piden a Firestore un año a
 * la vez: cada documento leído cuenta para la cuota diaria, y el archivo crece con los años.
 * "Todos los años" sigue disponible, pero solo se consulta si alguien lo elige.
 */

/** Valor del selector para consultar todo el archivo. */
export const ALL_YEARS = 'todos'

/** Inicio del año y del siguiente, para consultar un rango [inicio, fin). */
export function getYearBounds(year: number): [Date, Date] {
  return [new Date(year, 0, 1), new Date(year + 1, 0, 1)]
}

/** Años para elegir, del actual al del primer registro; sin registros, solo el actual. */
export function getYearOptions(firstYear: number | undefined, today = new Date()): number[] {
  const current = today.getFullYear()
  const first = Math.min(firstYear ?? current, current)
  return Array.from({ length: current - first + 1 }, (_, index) => current - index)
}

/** Año del selector como número, o undefined si se eligió todo el archivo. */
export function parseYear(value: string): number | undefined {
  return value === ALL_YEARS ? undefined : Number(value)
}
