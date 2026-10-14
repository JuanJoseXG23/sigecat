import { fromDateKey, toDateKey } from './expedient-deadline'
import { answeredOnTime } from './management-panel'
import type { Expedient } from '@/types/expedient'

/**
 * Calendario de cada persona. Los vencimientos salen de la fecha límite que ya guarda cada
 * expediente (no se guarda nada aparte) y se pintan con el semáforo; los respondidos, con otro
 * color. Los recordatorios sí son documentos propios (src/lib/reminders.ts).
 */

/** Las 6 semanas (42 días, de lunes a domingo) que muestra el mes, como yyyy-mm-dd. */
export function getMonthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  // getDay: 0 = domingo. La semana empieza el lunes.
  const offset = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) =>
    toDateKey(new Date(year, month, 1 - offset + index)),
  )
}

/** Primer y último día del cuadro del mes, para pedir solo lo que se ve. */
export function getGridRange(year: number, month: number): { start: Date; end: Date } {
  const grid = getMonthGrid(year, month)
  const end = fromDateKey(grid[grid.length - 1])
  end.setDate(end.getDate() + 1)
  return { start: fromDateKey(grid[0]), end }
}

export type DeadlineTone = 'vencido' | 'proximo' | 'en-plazo' | 'respondido' | 'respondido-tarde'

export const DEADLINE_TONE_LABELS: Record<DeadlineTone, string> = {
  vencido: 'Vencido',
  proximo: 'Próximo a vencer',
  'en-plazo': 'En plazo',
  respondido: 'Respondido a tiempo',
  'respondido-tarde': 'Respondido fuera de término',
}

type DeadlineLike = Pick<
  Expedient,
  | 'estado'
  | 'activo'
  | 'estadoTermino'
  | 'fechaLimite'
  | 'fechaRadicadoActuacion'
  | 'fechaCierre'
  | 'fechaActualizacion'
>

/** Color del vencimiento: semáforo si sigue en trámite; si ya se respondió, a tiempo o no. */
export function getDeadlineTone(item: DeadlineLike): DeadlineTone {
  const onTime = answeredOnTime(item)
  if (onTime !== null) return onTime ? 'respondido' : 'respondido-tarde'
  if (item.estadoTermino === 'Vencido') return 'vencido'
  if (item.estadoTermino === 'Próximo a vencer') return 'proximo'
  return 'en-plazo'
}

/**
 * Vencimientos de una persona: los expedientes en trámite que tiene asignados y los que
 * respondió (quien quedó como responsable al cerrar). Los archivados sin respuesta no cuentan.
 */
export function isDeadlineOf(
  item: Pick<Expedient, 'funcionarioAsignado' | 'estado' | 'activo' | 'fechaLimite'>,
  uid: string,
): boolean {
  if (!item.fechaLimite || item.funcionarioAsignado?.uid !== uid) return false
  return item.activo || item.estado === 'Archivo (Finalizado)'
}

/** Agrupa por día (yyyy-mm-dd) cualquier lista con su fecha. */
export function groupByDay<T>(items: T[], dayOf: (item: T) => string): Map<string, T[]> {
  const days = new Map<string, T[]>()
  for (const item of items) {
    const day = dayOf(item)
    days.set(day, [...(days.get(day) ?? []), item])
  }
  return days
}
