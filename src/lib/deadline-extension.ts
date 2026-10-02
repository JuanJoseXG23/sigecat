import { isInstitutionalDocumentUrl } from './document-links'
import { addBusinessDays, toDateKey } from './expedient-deadline'

/**
 * Ampliación del término de respuesta (parágrafo del art. 14 de la Ley 1437 de 2011,
 * sustituido por la Ley 1755 de 2015): antes de que venza el término se informa al
 * peticionario el motivo y el nuevo plazo, que no puede exceder el doble del inicial.
 * Es lógica pura y probada; el servicio solo guarda lo que aquí se decide.
 */

/** El plazo ampliado no puede superar este múltiplo del término inicial. */
export const MAX_EXTENSION_FACTOR = 2

/** Lo que la persona diligencia para ampliar el plazo. */
export interface ExtensionInput {
  /** Radicado del oficio que comunica la ampliación al peticionario. */
  filingNumber: string
  filingDate: string
  requestedDays: number
  reason: string
  documentName: string
  documentUrl: string
}

export const EMPTY_EXTENSION_INPUT: ExtensionInput = {
  filingNumber: '',
  filingDate: '',
  requestedDays: 0,
  reason: '',
  documentName: '',
  documentUrl: '',
}

export interface ExtensionContext {
  /** Fecha de radicado de entrada (yyyy-mm-dd). */
  entryDate: string
  currentDeadline: Date
  /** Término inicial del tipo de trámite, en días hábiles. */
  responseDays: number
  /** Días hábiles ya ampliados en solicitudes anteriores. */
  previousExtensionDays: number
  holidays?: string[]
  today?: Date
}

/** Días hábiles que todavía se pueden ampliar. */
export function getAvailableExtensionDays(
  context: Pick<ExtensionContext, 'responseDays' | 'previousExtensionDays'>,
): number {
  return Math.max(0, context.responseDays * MAX_EXTENSION_FACTOR - context.previousExtensionDays)
}

/** Primer dato inválido o pendiente, o null si la ampliación se puede registrar. */
export function getExtensionError(input: ExtensionInput, context: ExtensionContext): string | null {
  if (!input.documentName.trim() || !input.documentUrl.trim())
    return 'Asocia el radicado escaneado de la solicitud de ampliación.'
  if (!isInstitutionalDocumentUrl(input.documentUrl.trim()))
    return 'Usa un enlace HTTPS válido de OneDrive o SharePoint institucional.'
  if (!input.filingNumber.trim() || !input.filingDate)
    return 'Registra el número y la fecha del radicado de la ampliación.'
  const today = toDateKey(context.today ?? new Date())
  if (input.filingDate < context.entryDate)
    return 'La fecha del radicado no puede ser anterior a la radicación del expediente.'
  if (input.filingDate > today) return 'La fecha del radicado no puede ser futura.'
  if (input.filingDate > toDateKey(context.currentDeadline))
    return 'La ampliación debe comunicarse antes de que venza el término actual.'
  if (!Number.isInteger(input.requestedDays) || input.requestedDays < 1)
    return 'Indica cuántos días hábiles se amplía el plazo.'
  const available = getAvailableExtensionDays(context)
  if (input.requestedDays > available)
    return available === 0
      ? `Ya se usó toda la ampliación permitida (${context.responseDays * MAX_EXTENSION_FACTOR} días hábiles).`
      : `Puedes ampliar como máximo ${available} días hábiles más: el plazo no puede exceder el doble del término inicial.`
  if (!input.reason.trim()) return 'Explica el motivo de la ampliación.'
  return null
}

export interface ExtensionPlan {
  newDeadline: Date
  totalExtensionDays: number
}

export function planExtension(input: ExtensionInput, context: ExtensionContext): ExtensionPlan {
  const error = getExtensionError(input, context)
  if (error) throw new Error(error)
  return {
    newDeadline: addBusinessDays(context.currentDeadline, input.requestedDays, context.holidays),
    totalExtensionDays: context.previousExtensionDays + input.requestedDays,
  }
}

/** Fecha límite que resultaría de ampliar, para mostrarla antes de guardar. */
export function previewExtendedDeadline(
  currentDeadline: Date,
  requestedDays: number,
  holidays: string[] = [],
): Date | null {
  return Number.isInteger(requestedDays) && requestedDays > 0
    ? addBusinessDays(currentDeadline, requestedDays, holidays)
    : null
}
