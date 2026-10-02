/**
 * Festivos nacionales de Colombia (Ley 51 de 1983, "Ley Emiliani", y Ley 37 de 1905).
 * Se calculan para cualquier año, así que no hay que registrarlos a mano cada enero.
 * google-apps-script/Code.gs repite este cálculo para las alertas; si cambia uno, debe
 * cambiar el otro.
 */

export interface Holiday {
  /** Fecha en formato yyyy-mm-dd. */
  date: string
  name: string
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Domingo de Pascua (algoritmo anónimo gregoriano de Meeus/Jones/Butcher). */
export function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Ley Emiliani: si el festivo no cae en lunes, se traslada al lunes siguiente. */
function nextMonday(date: Date): Date {
  const offset = (8 - date.getDay()) % 7
  return addDays(date, offset)
}

const FIXED: [month: number, day: number, name: string][] = [
  [1, 1, 'Año Nuevo'],
  [5, 1, 'Día del Trabajo'],
  [7, 20, 'Día de la Independencia'],
  [8, 7, 'Batalla de Boyacá'],
  [12, 8, 'Inmaculada Concepción'],
  [12, 25, 'Navidad'],
]

const MOVABLE: [month: number, day: number, name: string][] = [
  [1, 6, 'Día de los Reyes Magos'],
  [3, 19, 'Día de San José'],
  [6, 29, 'San Pedro y San Pablo'],
  [8, 15, 'Asunción de la Virgen'],
  [10, 12, 'Día de la Raza'],
  [11, 1, 'Todos los Santos'],
  [11, 11, 'Independencia de Cartagena'],
]

/** Días contados desde el domingo de Pascua; los marcados se trasladan a lunes. */
const EASTER_BASED: [offset: number, moveToMonday: boolean, name: string][] = [
  [-3, false, 'Jueves Santo'],
  [-2, false, 'Viernes Santo'],
  [39, true, 'Ascensión del Señor'],
  [60, true, 'Corpus Christi'],
  [68, true, 'Sagrado Corazón de Jesús'],
]

const cache = new Map<number, Holiday[]>()

export function getColombianHolidays(year: number): Holiday[] {
  const cached = cache.get(year)
  if (cached) return cached
  const easter = getEasterSunday(year)
  const all: Holiday[] = [
    ...FIXED.map(([month, day, name]) => ({ date: dateKey(new Date(year, month - 1, day)), name })),
    ...MOVABLE.map(([month, day, name]) => ({
      date: dateKey(nextMonday(new Date(year, month - 1, day))),
      name,
    })),
    ...EASTER_BASED.map(([offset, moveToMonday, name]) => {
      const date = addDays(easter, offset)
      return { date: dateKey(moveToMonday ? nextMonday(date) : date), name }
    }),
  ]
  // Algunos años dos festivos caen el mismo lunes (30 de junio de 2025); se muestran juntos.
  const byDate = new Map<string, string>()
  for (const { date, name } of all) {
    const existing = byDate.get(date)
    byDate.set(date, existing ? `${existing} · ${name}` : name)
  }
  const holidays = [...byDate]
    .map(([date, name]) => ({ date, name }))
    .sort((first, second) => first.date.localeCompare(second.date))
  cache.set(year, holidays)
  return holidays
}

const keyCache = new Map<number, Set<string>>()

/** Indica si la fecha (yyyy-mm-dd) es festivo nacional. */
export function isColombianHoliday(key: string): boolean {
  const year = Number(key.slice(0, 4))
  let keys = keyCache.get(year)
  if (!keys) {
    keys = new Set(getColombianHolidays(year).map((holiday) => holiday.date))
    keyCache.set(year, keys)
  }
  return keys.has(key)
}
