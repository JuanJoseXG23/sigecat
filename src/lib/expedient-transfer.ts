import type { ExpedientTransfer } from '@/types/expedient'
import type { CorrespondenceClass } from './correspondence'
import { DEPENDENCIES, getDependencyName, type DependencyId } from './dependencies'
import { parseDocumentLink, type NewDocumentLink } from './document-links'
import { toDateKey } from './expedient-deadline'
import { getFilingNumberError } from './filing-number'
import { formatDate } from './format'

/**
 * Transferencia a otra dependencia: el expediente se cierra aquí (estado Transferido) y queda la
 * traza de cuándo, a dónde y por qué se envió. Es distinta del traslado por competencia, que
 * sigue el flujo hasta responder al ciudadano. Es lógica pura y probada; el servicio solo guarda
 * lo que aquí se decide, y firestore.rules repite los límites de destino y motivo.
 */

/** Destino fuera de las áreas de SIGECAT: se escribe su nombre. */
export const OTHER_DESTINATION = 'otra'

/** Mismos límites que isValidTransfer en firestore.rules. */
export const MIN_DESTINATION_LENGTH = 3
export const MAX_DESTINATION_LENGTH = 120
export const MIN_REASON_LENGTH = 5
export const MAX_REASON_LENGTH = 1000

/** Lo que la persona diligencia para transferir. */
export interface TransferInput {
  destination: DependencyId | typeof OTHER_DESTINATION | ''
  otherDestination: string
  reason: string
  /** Fecha de la transferencia (yyyy-mm-dd). */
  date: string
  /** Radicado opcional del oficio con que se envió. */
  filingNumber: string
  filingDate: string
  /** Documento opcional del oficio en OneDrive. */
  documentName: string
  documentUrl: string
  folios: string
}

export const EMPTY_TRANSFER_INPUT: TransferInput = {
  destination: '',
  otherDestination: '',
  reason: '',
  date: '',
  filingNumber: '',
  filingDate: '',
  documentName: '',
  documentUrl: '',
  folios: '',
}

export interface TransferContext {
  /** Área actual del expediente: no se transfiere a sí misma. */
  dependency: DependencyId
  /** Fecha de radicado de entrada (yyyy-mm-dd). */
  entryDate: string
  correspondenceClass: CorrespondenceClass
  today?: Date
}

export interface TransferPlan {
  transfer: Omit<ExpedientTransfer, 'usuario' | 'fechaRegistro'>
  document?: NewDocumentLink & { radicadoNumero?: string; radicadoFecha?: string }
  filing?: { numero: string; fecha: string }
  historyDetail: string
}

const isDependencyId = (value: string): value is DependencyId =>
  DEPENDENCIES.some((item) => item.id === value)

function hasDocument(input: TransferInput) {
  return Boolean(input.documentName.trim() || input.documentUrl.trim())
}

function hasFiling(input: TransferInput) {
  return Boolean(input.filingNumber.trim() || input.filingDate)
}

/** Primer dato inválido o pendiente, o null si la transferencia se puede registrar. */
export function getTransferError(input: TransferInput, context: TransferContext): string | null {
  if (!input.destination) return 'Elige el destino de la transferencia.'
  if (input.destination === context.dependency)
    return 'El destino es la misma área del expediente: elige otro.'
  if (input.destination === OTHER_DESTINATION) {
    const name = input.otherDestination.trim()
    if (name.length < MIN_DESTINATION_LENGTH || name.length > MAX_DESTINATION_LENGTH)
      return `Escribe el nombre de la dependencia destino (${MIN_DESTINATION_LENGTH} a ${MAX_DESTINATION_LENGTH} caracteres).`
  }
  const reason = input.reason.trim()
  if (reason.length < MIN_REASON_LENGTH || reason.length > MAX_REASON_LENGTH)
    return `Explica el motivo de la transferencia (${MIN_REASON_LENGTH} a ${MAX_REASON_LENGTH} caracteres).`
  const today = toDateKey(context.today ?? new Date())
  if (!input.date) return 'Indica la fecha de la transferencia.'
  if (input.date > today) return 'La fecha de la transferencia no puede ser futura.'
  if (input.date < context.entryDate)
    return 'La fecha de la transferencia no puede ser anterior a la radicación del expediente.'
  if (hasFiling(input)) {
    if (!input.filingNumber.trim() || !input.filingDate)
      return 'Registra el número y la fecha del radicado del oficio, o deja ambos vacíos.'
    const error = getFilingNumberError(
      input.filingNumber,
      input.filingDate,
      'salida',
      context.correspondenceClass,
    )
    if (error) return `Radicado del oficio: ${error}`
    if (input.filingDate > today) return 'La fecha del radicado no puede ser futura.'
  }
  if (hasDocument(input)) {
    const parsed = parseDocumentLink(input.documentName, input.documentUrl, input.folios)
    if ('error' in parsed) return parsed.error
  }
  return null
}

/** Traduce lo diligenciado en lo que se guarda; lanza el error si algo no es válido. */
export function planTransfer(input: TransferInput, context: TransferContext): TransferPlan {
  const error = getTransferError(input, context)
  if (error) throw new Error(error)
  const internalArea = isDependencyId(input.destination) ? input.destination : undefined
  const destino = internalArea ? getDependencyName(internalArea) : input.otherDestination.trim()
  const motivo = input.reason.trim()
  const filing = hasFiling(input)
    ? { numero: input.filingNumber.trim(), fecha: input.filingDate }
    : undefined
  const parsed = hasDocument(input)
    ? parseDocumentLink(input.documentName, input.documentUrl, input.folios)
    : undefined
  const document =
    parsed && 'document' in parsed
      ? {
          ...parsed.document,
          ...(filing ? { radicadoNumero: filing.numero, radicadoFecha: filing.fecha } : {}),
        }
      : undefined

  return {
    transfer: {
      destino,
      ...(internalArea ? { dependenciaDestino: internalArea } : {}),
      motivo,
      fecha: input.date,
      ...(filing ? { numeroRadicado: filing.numero, fechaRadicado: filing.fecha } : {}),
    },
    ...(document ? { document } : {}),
    ...(filing ? { filing } : {}),
    historyDetail: [
      `A ${destino} el ${formatDate(input.date)}. Motivo: ${motivo}`,
      filing && `Radicado ${filing.numero}.`,
    ]
      .filter(Boolean)
      .join(' '),
  }
}
