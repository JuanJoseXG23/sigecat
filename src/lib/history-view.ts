import { normalizeSearch } from './format'

/**
 * Cómo se muestra el historial de un expediente: cada entrada cae en una categoría para filtrar
 * (trámite, radicados y plazos, documentos, correcciones, correos, notas), se puede buscar por
 * texto y se agrupa por día. Las categorías salen del nombre de la acción, que es lo que guardan
 * la app, el registro tardío y Apps Script.
 */
export type HistoryCategory =
  'tramite' | 'radicados' | 'documentos' | 'correcciones' | 'comunicaciones' | 'notas'

export const HISTORY_CATEGORIES: { id: HistoryCategory; label: string }[] = [
  { id: 'tramite', label: 'Trámite' },
  { id: 'radicados', label: 'Radicados y plazos' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'correcciones', label: 'Correcciones' },
  { id: 'comunicaciones', label: 'Correos y preguntas' },
  { id: 'notas', label: 'Notas' },
]

/** El orden importa: "Corrigió radicado" es una corrección antes que un radicado. */
export function categorizeHistoryAction(action: string): HistoryCategory {
  if (action === 'Nota') return 'notas'
  if (/^(Corrigió|Edición del expediente|Actualización del expediente)/.test(action))
    return 'correcciones'
  if (/^(Pregunta|Correo|Alerta)/.test(action)) return 'comunicaciones'
  if (/^Documento/.test(action)) return 'documentos'
  if (/radic(ad|ó)|plazo|fecha límite/i.test(action)) return 'radicados'
  return 'tramite'
}

interface EntryLike {
  accion: string
  detalle: string
  usuario: string
  fecha: { toDate(): Date } | null
}

/** Coincide si el texto aparece en la acción, el detalle o el nombre de quien la hizo. */
export function matchesHistorySearch(entry: EntryLike, search: string, userName: string): boolean {
  const needle = normalizeSearch(search)
  if (!needle) return true
  return normalizeSearch(`${entry.accion} ${entry.detalle} ${userName}`).includes(needle)
}

/** Clave yyyy-mm-dd del día local de la entrada; '' si aún no tiene hora del servidor. */
export function historyDayKey(entry: Pick<EntryLike, 'fecha'>): string {
  const date = entry.fecha?.toDate()
  if (!date) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Entradas consecutivas del mismo día, en el orden recibido. */
export function groupHistoryByDay<T extends Pick<EntryLike, 'fecha'>>(
  entries: T[],
): { day: string; entries: T[] }[] {
  const groups: { day: string; entries: T[] }[] = []
  for (const entry of entries) {
    const day = historyDayKey(entry)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.entries.push(entry)
    else groups.push({ day, entries: [entry] })
  }
  return groups
}

const CHANGE_LABELS = [
  'Área',
  'Radicado de entrada',
  'Fecha de radicado',
  'Fecha de recibido',
  'Medio de ingreso',
  'Tipo de trámite',
  'Responsable',
  'Prioridad',
  'Solicitantes',
  'Predios',
]
const SUMMARY_CHANGES = [
  'Asunto actualizado',
  'Datos de contacto del solicitante actualizados',
  'Observaciones iniciales actualizadas',
]

export interface HistoryChange {
  label?: string
  before?: string
  after?: string
  text: string
}

/**
 * Separa el detalle de una edición ("Área: A → B. Asunto actualizado") en sus cambios, para
 * mostrarlos como lista. Solo corta donde empieza un dato conocido, así un valor con punto no
 * se parte. Un detalle que no tiene esa forma vuelve como un único texto.
 */
export function splitHistoryChanges(detail: string): HistoryChange[] {
  const starts = [...CHANGE_LABELS.map((label) => `${label}: `), ...SUMMARY_CHANGES]
  const pattern = new RegExp(
    `\\. (?=${starts.map((start) => start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  )
  return detail
    .split(pattern)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const label = CHANGE_LABELS.find((name) => part.startsWith(`${name}: `))
      if (!label) return { text: part }
      const [before, after] = part.slice(label.length + 2).split(' → ')
      return after === undefined ? { text: part } : { label, before, after, text: part }
    })
}
