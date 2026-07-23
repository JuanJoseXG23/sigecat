const DEFAULT_PROCESSING_TERM_DAYS = 15

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function addBusinessDays(startDate: Date, days: number): Date {
  let result = startOfDay(startDate)
  let addedDays = 0

  while (addedDays < days) {
    result = addDays(result, 1)
    if (isBusinessDay(result)) addedDays += 1
  }

  return result
}

export function getRemainingBusinessDays(deadline: Date, today = new Date()): number {
  const target = startOfDay(deadline)
  let cursor = startOfDay(today)
  const direction = target >= cursor ? 1 : -1
  let remainingDays = 0

  while (cursor.getTime() !== target.getTime()) {
    cursor = addDays(cursor, direction)
    if (isBusinessDay(cursor)) remainingDays += direction
  }

  return remainingDays
}

export function calculateExpedientTimeline(filingDate: string, today = new Date()) {
  const [year, month, day] = filingDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const fechaLimite = addBusinessDays(date, DEFAULT_PROCESSING_TERM_DAYS)

  return { fechaLimite, diasRestantes: getRemainingBusinessDays(fechaLimite, today) }
}
