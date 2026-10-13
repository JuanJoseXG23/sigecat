import type { Expedient, ExpedientStatus } from '@/types/expedient'
// Relativa: las pruebas corren con tsx, que no resuelve el alias @/ en importaciones de valor.
import { getResponseDate } from '../types/expedient'

/**
 * Indicadores del Panel de dirección: lo que la jefatura necesita para vigilar los derechos de
 * petición de un vistazo. Es lógica pura y probada; la página solo la dibuja.
 */

/** Pasos activos en el orden en que avanza un expediente. */
export const ACTIVE_STAGES: ExpedientStatus[] = [
  'Recibido',
  'Asignado',
  'En respuesta',
  'Radicado de salida',
  'Traslado por competencia',
  'Generar radicado de traslado',
  'Generar respuesta al ciudadano',
  'Radicar respuesta',
]

export type Traffic = 'En plazo' | 'Próximo a vencer' | 'Vencido'
export const TRAFFIC: Traffic[] = ['En plazo', 'Próximo a vencer', 'Vencido']

export type TrafficCounts = Record<Traffic, number>

const emptyTraffic = (): TrafficCounts => ({ 'En plazo': 0, 'Próximo a vencer': 0, Vencido: 0 })

export function countByTraffic(items: Pick<Expedient, 'estadoTermino'>[]): TrafficCounts {
  const counts = emptyTraffic()
  for (const item of items) if (item.estadoTermino) counts[item.estadoTermino] += 1
  return counts
}

/** Activos por paso del flujo, en orden y sin los pasos vacíos. */
export function countByStage(items: Pick<Expedient, 'estado'>[]): [ExpedientStatus, number][] {
  return ACTIVE_STAGES.map(
    (stage) =>
      [stage, items.filter((item) => item.estado === stage).length] as [ExpedientStatus, number],
  ).filter(([, count]) => count > 0)
}

export interface Workload {
  uid: string
  name: string
  total: number
  traffic: TrafficCounts
}

/** Carga de cada responsable, del que más vencidos tiene al que menos. */
export function getWorkload(
  items: Pick<Expedient, 'funcionarioAsignado' | 'responsableExterno' | 'estadoTermino'>[],
): Workload[] {
  const byPerson = new Map<string, Workload>()
  for (const item of items) {
    const uid = item.funcionarioAsignado?.uid ?? ''
    const name = item.funcionarioAsignado?.nombreCompleto ?? 'Sin responsable'
    const entry = byPerson.get(uid) ?? { uid, name, total: 0, traffic: emptyTraffic() }
    entry.total += 1
    if (item.estadoTermino) entry.traffic[item.estadoTermino] += 1
    byPerson.set(uid, entry)
  }
  return [...byPerson.values()].sort(
    (a, b) =>
      b.traffic.Vencido - a.traffic.Vencido ||
      b.traffic['Próximo a vencer'] - a.traffic['Próximo a vencer'] ||
      b.total - a.total ||
      a.name.localeCompare(b.name),
  )
}

type ClosedLike = Pick<
  Expedient,
  | 'estado'
  | 'activo'
  | 'fechaLimite'
  | 'fechaRadicadoActuacion'
  | 'fechaCierre'
  | 'fechaActualizacion'
>

/** Respondido (finalizado en el flujo), no archivado administrativamente. */
export function isAnswered(item: Pick<Expedient, 'estado' | 'activo'>): boolean {
  return !item.activo && item.estado === 'Archivo (Finalizado)'
}

/** true/false si se respondió a tiempo; null si no aplica (activo, archivado o sin término). */
export function answeredOnTime(item: ClosedLike): boolean | null {
  if (!isAnswered(item) || !item.fechaLimite) return null
  const deadline = item.fechaLimite.toDate()
  deadline.setHours(23, 59, 59, 999)
  return getResponseDate(item) <= deadline
}

export interface Timeliness {
  onTime: number
  late: number
  /** Porcentaje entero, o null si no hay respuestas para evaluar. */
  rate: number | null
}

export function getTimeliness(items: ClosedLike[]): Timeliness {
  const results = items.map(answeredOnTime).filter((value) => value !== null)
  const onTime = results.filter(Boolean).length
  return {
    onTime,
    late: results.length - onTime,
    rate: results.length ? Math.round((onTime * 100) / results.length) : null,
  }
}

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export interface MonthPoint {
  /** yyyy-mm */
  month: string
  received: number
  answered: number
  answeredOnTime: number
}

/** Radicados y respondidos de los últimos `months` meses, del más antiguo al actual. */
export function getMonthlySeries(
  items: (ClosedLike & Pick<Expedient, 'fechaRadicado'>)[],
  months = 6,
  today = new Date(),
): MonthPoint[] {
  const points = Array.from({ length: months }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (months - 1 - index), 1)
    return { month: monthKey(date), received: 0, answered: 0, answeredOnTime: 0 }
  })
  const byMonth = new Map(points.map((point) => [point.month, point]))
  for (const item of items) {
    const received = byMonth.get(monthKey(item.fechaRadicado.toDate()))
    if (received) received.received += 1
    if (!isAnswered(item)) continue
    const answered = byMonth.get(monthKey(getResponseDate(item)))
    if (!answered) continue
    answered.answered += 1
    if (answeredOnTime(item)) answered.answeredOnTime += 1
  }
  return points
}

/** Respondidos en el mes de `today`. */
export function countAnsweredThisMonth(items: ClosedLike[], today = new Date()): number {
  const key = monthKey(today)
  return items.filter((item) => isAnswered(item) && monthKey(getResponseDate(item)) === key).length
}

/** Últimos respondidos, del más reciente al más antiguo. */
export function getRecentlyAnswered<T extends ClosedLike>(items: T[], limit = 8): T[] {
  return items
    .filter(isAnswered)
    .sort((a, b) => getResponseDate(b).getTime() - getResponseDate(a).getTime())
    .slice(0, limit)
}
