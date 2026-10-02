import { isColombianHoliday } from './colombian-holidays'

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Día hábil: de lunes a viernes, sin festivos nacionales (que se calculan solos) ni los días
 * adicionales sin atención que el Administrador registra en Configuración.
 */
export function isBusinessDay(date: Date, extraHolidays: ReadonlySet<string> = new Set()) {
  const day = date.getDay()
  const key = toDateKey(date)
  return day !== 0 && day !== 6 && !isColombianHoliday(key) && !extraHolidays.has(key)
}

/** Fecha local en formato yyyy-mm-dd; a diferencia de toISOString, no se desplaza a UTC. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Convierte yyyy-mm-dd en una fecha local a medianoche. */
export function fromDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function addBusinessDays(startDate: Date, days: number, holidays: string[] = []): Date {
  const extra = new Set(holidays)
  let result = startOfDay(startDate)
  let addedDays = 0

  while (addedDays < days) {
    result = addDays(result, 1)
    if (isBusinessDay(result, extra)) addedDays += 1
  }

  return result
}

export function getRemainingBusinessDays(
  deadline: Date,
  today = new Date(),
  holidays: string[] = [],
): number {
  const extra = new Set(holidays)
  const target = startOfDay(deadline)
  let cursor = startOfDay(today)
  const direction = target >= cursor ? 1 : -1
  let remainingDays = 0

  while (cursor.getTime() !== target.getTime()) {
    cursor = addDays(cursor, direction)
    if (isBusinessDay(cursor, extra)) remainingDays += direction
  }

  return remainingDays
}

export function calculateExpedientTimeline(
  filingDate: string,
  responseDays: number,
  today = new Date(),
  holidays: string[] = [],
) {
  const fechaLimite = addBusinessDays(fromDateKey(filingDate), responseDays, holidays)
  return { fechaLimite, diasRestantes: getRemainingBusinessDays(fechaLimite, today, holidays) }
}
