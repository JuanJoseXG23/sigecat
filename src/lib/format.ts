/** Formatos de fecha en español de Colombia, compartidos por todas las pantallas. */

type DateLike = Date | { toDate: () => Date } | string | null | undefined

function toDate(value: DateLike): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    return year ? new Date(year, month - 1, day) : null
  }
  return value.toDate()
}

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const longDateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' })
const dateTimeFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

/** 2 oct 2026 */
export function formatDate(value: DateLike, empty = '—'): string {
  const date = toDate(value)
  return date ? dateFormat.format(date) : empty
}

/** viernes, 2 de octubre de 2026 */
export function formatLongDate(value: DateLike, empty = '—'): string {
  const date = toDate(value)
  if (!date) return empty
  const text = longDateFormat.format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** 2 oct 2026, 3:15 p. m. */
export function formatDateTime(value: DateLike, empty = '—'): string {
  const date = toDate(value)
  return date ? dateTimeFormat.format(date) : empty
}

/** "Vence hoy", "Quedan 3 días hábiles", "Vencido hace 2 días hábiles". */
export function describeRemainingDays(days: number | undefined): string {
  if (days === undefined) return 'Sin término'
  if (days === 0) return 'Vence hoy'
  const plural = Math.abs(days) === 1 ? 'día hábil' : 'días hábiles'
  return days > 0 ? `Quedan ${days} ${plural}` : `Vencido hace ${Math.abs(days)} ${plural}`
}

export function initials(name?: string): string {
  return (
    name
      ?.split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  )
}

/** Normaliza para buscar sin distinguir mayúsculas ni tildes. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-CO')
    .trim()
}
