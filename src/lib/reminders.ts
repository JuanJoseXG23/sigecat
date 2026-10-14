import { isInstitutionalDocumentUrl } from './document-links'

/**
 * Recordatorios: un aviso con fecha para una persona. Cada quien se los crea a sí mismo;
 * Administrador y Coordinador también a otros. El día del recordatorio, Apps Script le envía un
 * correo a quien lo recibe. Los documentos son enlaces opcionales del OneDrive institucional.
 * firestore.rules repite estos límites.
 */
export const MIN_REMINDER_TITLE = 3
export const MAX_REMINDER_TITLE = 120
export const MAX_REMINDER_DESCRIPTION = 1000
export const MAX_REMINDER_DOCUMENTS = 5

export interface ReminderDocument {
  nombre: string
  url: string
}

export interface ReminderInput {
  titulo: string
  descripcion: string
  /** yyyy-mm-dd */
  fecha: string
  destinatarios: string[]
  documentos: ReminderDocument[]
}

/** Primer dato pendiente o inválido, o null si se puede guardar. */
export function getReminderError(input: ReminderInput, today: string): string | null {
  const title = input.titulo.trim()
  if (title.length < MIN_REMINDER_TITLE)
    return `Escribe de qué se trata (al menos ${MIN_REMINDER_TITLE} caracteres).`
  if (title.length > MAX_REMINDER_TITLE)
    return `El título admite hasta ${MAX_REMINDER_TITLE} caracteres.`
  if (input.descripcion.trim().length > MAX_REMINDER_DESCRIPTION)
    return `La descripción admite hasta ${MAX_REMINDER_DESCRIPTION} caracteres.`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return 'Elige el día del recordatorio.'
  if (input.fecha < today) return 'El día del recordatorio no puede ser anterior a hoy.'
  if (!input.destinatarios.length) return 'Elige al menos una persona.'
  if (input.documentos.length > MAX_REMINDER_DOCUMENTS)
    return `Puedes adjuntar hasta ${MAX_REMINDER_DOCUMENTS} documentos.`
  for (const document of input.documentos) {
    if (!document.nombre.trim() || !document.url.trim())
      return 'Cada documento necesita nombre y enlace.'
    if (!isInstitutionalDocumentUrl(document.url.trim()))
      return 'Los documentos deben ser enlaces HTTPS del OneDrive o SharePoint institucional.'
  }
  return null
}
