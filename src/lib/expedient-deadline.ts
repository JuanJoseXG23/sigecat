function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6 && !holidays.has(toDateKey(date))
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function addBusinessDays(startDate: Date, days: number, holidays: string[] = []): Date {
  let result = startOfDay(startDate)
  let addedDays = 0

  while (addedDays < days) {
    result = addDays(result, 1)
    if (isBusinessDay(result, new Set(holidays))) addedDays += 1
  }

  return result
}

export function getRemainingBusinessDays(deadline: Date, today = new Date(), holidays: string[] = []): number {
  const target = startOfDay(deadline)
  let cursor = startOfDay(today)
  const direction = target >= cursor ? 1 : -1
  let remainingDays = 0

  while (cursor.getTime() !== target.getTime()) {
    cursor = addDays(cursor, direction)
    if (isBusinessDay(cursor, new Set(holidays))) remainingDays += direction
  }

  return remainingDays
}

export function calculateExpedientTimeline(filingDate: string, responseDays: number, today = new Date(), holidays: string[] = []) {
  const [year, month, day] = filingDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const fechaLimite = addBusinessDays(date, responseDays, holidays)

  return { fechaLimite, diasRestantes: getRemainingBusinessDays(fechaLimite, today, holidays) }
}
