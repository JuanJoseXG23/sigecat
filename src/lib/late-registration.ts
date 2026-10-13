import type { AssignedOfficial, ExpedientStatus, WorkflowDocumentType } from '@/types/expedient'
import { getExtensionError, type ExtensionInput } from './deadline-extension'
import { parseDocumentLink, type NewDocumentLink } from './document-links'
import {
  addBusinessDays,
  fromDateKey,
  getRemainingBusinessDays,
  toDateKey,
} from './expedient-deadline'
import { formatDate } from './format'

/**
 * Registro tardío: actuaciones que se hicieron a tiempo en la oficina (respuesta, traslado,
 * ampliación de plazo) pero no se subieron a la aplicación. Se registran con sus fechas
 * reales y, en un solo paso, el expediente avanza en el mismo orden del flujo normal.
 * El término se evalúa con la fecha del radicado, no con el día en que se registra.
 * Es lógica pura y probada; el servicio solo guarda lo que aquí se decide.
 */

/** Art. 21 de la Ley 1755 de 2015: el traslado por competencia se hace en 5 días hábiles. */
export const TRANSFER_TERM_DAYS = 5

/** Cómo terminó el trámite en la realidad. */
export type LateOutcome = 'response' | 'transfer' | 'pending'

/** Un radicado ya enviado: número, fechas reales y escaneo en OneDrive. */
export interface LateFilingInput {
  number: string
  /** Fecha del radicado de salida (yyyy-mm-dd). */
  date: string
  /** Fecha en que se envió o notificó al destinatario (yyyy-mm-dd). */
  sentDate: string
  documentName: string
  documentUrl: string
  folios: string
}

export interface LateRegistrationInput {
  /** Por qué no se registró a tiempo; queda en el historial. */
  reason: string
  outcome: LateOutcome
  receipt: { signed: boolean; documentName: string; documentUrl: string; folios: string }
  /** Responsable del trámite, cuando el expediente aún no lo tenía. */
  assignee?: AssignedOfficial
  /** Quien proyectó y firmó la respuesta o el traslado, si no fue el responsable. */
  respondedBy?: AssignedOfficial
  extensionEnabled: boolean
  extension: ExtensionInput
  transfer: { destination: string; reason: string; filing: LateFilingInput }
  /** Traslado: la respuesta al ciudadano también se radicó. */
  citizenResponseSent: boolean
  response: LateFilingInput
  notes: string
}

export const EMPTY_LATE_FILING: LateFilingInput = {
  number: '',
  date: '',
  sentDate: '',
  documentName: '',
  documentUrl: '',
  folios: '',
}

export const EMPTY_LATE_REGISTRATION: LateRegistrationInput = {
  reason: '',
  outcome: 'response',
  receipt: { signed: false, documentName: '', documentUrl: '', folios: '' },
  extensionEnabled: false,
  extension: {
    filingNumber: '',
    filingDate: '',
    requestedDays: 0,
    reason: '',
    documentName: '',
    documentUrl: '',
  },
  transfer: { destination: '', reason: '', filing: EMPTY_LATE_FILING },
  citizenResponseSent: true,
  response: EMPTY_LATE_FILING,
  notes: '',
}

export interface ExistingDocument {
  nombre: string
  url: string
}

export interface LateRegistrationContext {
  status: ExpedientStatus
  entryNumber: string
  /** Fecha de radicado de entrada (yyyy-mm-dd). */
  entryDate: string
  /** Fecha límite vigente antes de este registro. */
  currentDeadline: Date
  /** Término inicial del tipo de trámite, en días hábiles. */
  responseDays: number
  previousExtensionDays: number
  currentAssignee?: AssignedOfficial
  /** Documento más reciente de cada tipo ya asociado al expediente. */
  existingDocuments: Partial<Record<WorkflowDocumentType, ExistingDocument>>
  holidays?: string[]
  today?: Date
}

/** Qué hay que diligenciar según el paso en que quedó el expediente en la aplicación. */
export interface LateRegistrationScope {
  /** Recibido: firma del formato y documento recibido. */
  receipt: boolean
  /** Recibido o Asignado: elegir responsable. */
  assignee: boolean
  /** Antes de En respuesta inclusive: el traslado necesita destino y motivo. */
  transferDestination: boolean
  outcomes: LateOutcome[]
  /** Flujo de traslado ya radicado: solo falta la respuesta al ciudadano. */
  citizenResponseOnly: boolean
}

export function getLateRegistrationScope(status: ExpedientStatus): LateRegistrationScope | null {
  const open = { receipt: false, assignee: false, citizenResponseOnly: false }
  switch (status) {
    case 'Recibido':
    case 'Asignado':
    case 'En respuesta':
      return {
        ...open,
        receipt: status === 'Recibido',
        assignee: status !== 'En respuesta',
        transferDestination: true,
        outcomes: ['response', 'transfer', 'pending'],
      }
    case 'Radicado de salida':
      return { ...open, transferDestination: false, outcomes: ['response', 'pending'] }
    case 'Traslado por competencia':
    case 'Generar radicado de traslado':
      return { ...open, transferDestination: false, outcomes: ['transfer', 'pending'] }
    case 'Generar respuesta al ciudadano':
    case 'Radicar respuesta':
      return {
        ...open,
        transferDestination: false,
        outcomes: ['response', 'pending'],
        citizenResponseOnly: true,
      }
    default:
      return null
  }
}

/** Secciones del asistente, en orden. */
export type LateSection = 'situation' | 'start' | 'extension' | 'outcome' | 'review'

export interface LateRegistrationIssue {
  section: LateSection
  message: string
}

/** Fecha límite de la ampliación, si la hay y es válida; si no, la vigente. */
function getEffectiveDeadline(input: LateRegistrationInput, context: LateRegistrationContext) {
  if (!input.extensionEnabled || !Number.isInteger(input.extension.requestedDays))
    return context.currentDeadline
  if (input.extension.requestedDays < 1) return context.currentDeadline
  return addBusinessDays(context.currentDeadline, input.extension.requestedDays, context.holidays)
}

function needsResponse(input: LateRegistrationInput): boolean {
  return input.outcome === 'response' || (input.outcome === 'transfer' && input.citizenResponseSent)
}

function getFilingError(
  filing: LateFilingInput,
  noun: string,
  context: LateRegistrationContext,
  existingDocument?: ExistingDocument,
): string | null {
  const today = toDateKey(context.today ?? new Date())
  if (!filing.number.trim() || !filing.date)
    return `Registra el número y la fecha del radicado de ${noun}.`
  if (filing.date < context.entryDate)
    return `La fecha del radicado de ${noun} no puede ser anterior a la radicación del expediente.`
  if (filing.date > today) return `La fecha del radicado de ${noun} no puede ser futura.`
  if (!filing.sentDate) return `Indica la fecha en que se envió ${noun}.`
  if (filing.sentDate < filing.date)
    return `La fecha de envío de ${noun} no puede ser anterior a su radicado.`
  if (filing.sentDate > today) return `La fecha de envío de ${noun} no puede ser futura.`
  const blank = !filing.documentName.trim() && !filing.documentUrl.trim() && !filing.folios.trim()
  if (existingDocument && blank) return null
  const parsed = parseDocumentLink(filing.documentName, filing.documentUrl, filing.folios)
  return 'error' in parsed ? `Escaneo de ${noun}: ${parsed.error}` : null
}

/** Primer dato pendiente o incoherente, con la sección donde corregirlo; null si está completo. */
export function getLateRegistrationIssue(
  input: LateRegistrationInput,
  context: LateRegistrationContext,
): LateRegistrationIssue | null {
  const scope = getLateRegistrationScope(context.status)
  if (!scope) return { section: 'situation', message: 'El expediente ya está cerrado.' }
  const issue = (section: LateSection, message: string) => ({ section, message })

  if (!scope.outcomes.includes(input.outcome))
    return issue('situation', 'Elige qué pasó con el trámite.')
  if (!input.reason.trim())
    return issue('situation', 'Explica por qué no se registró a tiempo en la aplicación.')

  if (scope.receipt) {
    if (!context.existingDocuments.RECIBIDO) {
      const parsed = parseDocumentLink(
        input.receipt.documentName,
        input.receipt.documentUrl,
        input.receipt.folios,
      )
      if ('error' in parsed) return issue('start', `Documento recibido: ${parsed.error}`)
    }
    if (!input.receipt.signed) return issue('start', 'Confirma que el formato físico fue firmado.')
  }
  if (scope.assignee && !input.assignee) return issue('start', 'Selecciona el responsable.')

  if (input.extensionEnabled) {
    const extension = input.extension
    if (extension.filingDate && extension.filingDate > toDateKey(context.currentDeadline))
      return issue(
        'extension',
        `La ampliación se radicó el ${formatDate(extension.filingDate)}, después del vencimiento (${formatDate(context.currentDeadline)}): ya no era procedente. Quita la ampliación y registra la respuesta; quedará como fuera del término.`,
      )
    const error = getExtensionError(extension, {
      entryDate: context.entryDate,
      currentDeadline: context.currentDeadline,
      responseDays: context.responseDays,
      previousExtensionDays: context.previousExtensionDays,
      holidays: context.holidays,
      today: context.today,
    })
    if (error) return issue('extension', error)
  }

  if (input.outcome === 'pending') {
    if (!input.extensionEnabled && !scope.receipt && !scope.assignee)
      return issue(
        'situation',
        'No hay nada que registrar: si el trámite sigue en curso, registra al menos la ampliación de plazo.',
      )
    return null
  }

  if (input.outcome === 'transfer') {
    if (
      scope.transferDestination &&
      (!input.transfer.destination.trim() || !input.transfer.reason.trim())
    )
      return issue('outcome', 'Indica la entidad o dependencia destino y el motivo del traslado.')
    const error = getFilingError(
      input.transfer.filing,
      'el traslado',
      context,
      context.existingDocuments.TRASLADO,
    )
    if (error) return issue('outcome', error)
  }

  if (needsResponse(input)) {
    const noun =
      input.outcome === 'transfer' || scope.citizenResponseOnly
        ? 'la respuesta al ciudadano'
        : 'la respuesta'
    const error = getFilingError(
      input.response,
      noun,
      context,
      context.existingDocuments.RADICADO_SALIDA,
    )
    if (error) return issue('outcome', error)
    if (input.outcome === 'transfer' && input.response.date < input.transfer.filing.date)
      return issue('outcome', 'La respuesta al ciudadano no puede ser anterior al traslado.')
  }

  const lastFilingDate =
    input.outcome === 'transfer' ? input.transfer.filing.date : input.response.date
  if (input.extensionEnabled && lastFilingDate < input.extension.filingDate)
    return issue(
      'outcome',
      'La respuesta o el traslado no pueden ser anteriores a la ampliación de plazo.',
    )

  const numbers = [
    input.extensionEnabled && input.extension.filingNumber,
    input.outcome === 'transfer' && input.transfer.filing.number,
    needsResponse(input) && input.response.number,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
  if (numbers.includes(context.entryNumber.trim()))
    return issue(
      'outcome',
      `${context.entryNumber} es el radicado de entrada; usa el número del radicado de salida.`,
    )
  if (new Set(numbers).size !== numbers.length)
    return issue('outcome', 'Cada radicado debe tener un número distinto.')
  return null
}

export interface Timeliness {
  onTime: boolean
  /** Días hábiles de retraso; 0 si fue a tiempo. */
  businessDaysLate: number
}

/** Compara la fecha del radicado con la fecha límite, en días hábiles. */
export function evaluateTimeliness(
  filingDate: string,
  deadline: Date,
  holidays: string[] = [],
): Timeliness {
  const onTime = filingDate <= toDateKey(deadline)
  return {
    onTime,
    businessDaysLate: onTime
      ? 0
      : -getRemainingBusinessDays(deadline, fromDateKey(filingDate), holidays),
  }
}

export interface PlannedDocument extends NewDocumentLink {
  tipo: WorkflowDocumentType
  radicadoNumero?: string
  radicadoFecha?: string
}

export interface PlannedFiling {
  tipo: 'Salida' | 'Traslado' | 'Ampliación de plazo'
  numero: string
  fecha: string
  fechaEnvio?: string
  documento?: ExistingDocument
}

export interface LateRegistrationPlan {
  finalStatus: ExpedientStatus
  finalized: boolean
  /** Fecha real de cierre: la del radicado de la respuesta. */
  closingDate?: string
  /** Responsable final, si cambia. */
  assignee?: AssignedOfficial
  /** Campos del expediente, sin estado ni responsable. */
  fields: Record<string, string | boolean>
  documents: PlannedDocument[]
  filings: PlannedFiling[]
  extension?: { newDeadline: Date; totalExtensionDays: number }
  /** Entradas del historial en orden cronológico. */
  history: { action: string; detail: string }[]
  /** Respuesta frente a la fecha límite (con la ampliación). */
  timeliness?: Timeliness
  /** Traslado frente a los 5 días hábiles del art. 21. */
  transferTimeliness?: Timeliness
}

const describeFiling = (filing: LateFilingInput) =>
  `Radicado ${filing.number.trim()} del ${formatDate(filing.date)}, enviado el ${formatDate(filing.sentDate)}.`

/** Traduce lo diligenciado en lo que se debe guardar, en el orden del flujo. */
export function planLateRegistration(
  input: LateRegistrationInput,
  context: LateRegistrationContext,
): LateRegistrationPlan {
  const issue = getLateRegistrationIssue(input, context)
  if (issue) throw new Error(issue.message)
  const scope = getLateRegistrationScope(context.status)!
  const notes = input.notes.trim()
  const plan: LateRegistrationPlan = {
    finalStatus: context.status,
    finalized: false,
    fields: {},
    documents: [],
    filings: [],
    history: [
      {
        action: 'Registro tardío de actuaciones',
        detail: [input.reason.trim(), notes].filter(Boolean).join(' '),
      },
    ],
  }
  let assignee = context.currentAssignee

  if (scope.receipt) {
    if (!context.existingDocuments.RECIBIDO) {
      const parsed = parseDocumentLink(
        input.receipt.documentName,
        input.receipt.documentUrl,
        input.receipt.folios,
      ) as { document: NewDocumentLink }
      plan.documents.push({ ...parsed.document, tipo: 'RECIBIDO' })
    }
    plan.fields.formatoFisicoFirmado = true
    plan.history.push({
      action: 'Confirmó firma del formato físico',
      detail: 'Formato físico firmado.',
    })
  }
  if (scope.assignee && input.assignee) {
    if (input.assignee.uid !== assignee?.uid) {
      plan.history.push({
        action: 'Asignó responsable',
        detail: `${assignee?.nombreCompleto ?? 'Sin asignar'} → ${input.assignee.nombreCompleto}`,
      })
      plan.assignee = input.assignee
    }
    assignee = input.assignee
  }
  if (scope.receipt || scope.assignee) plan.finalStatus = 'En respuesta'

  let deadline = context.currentDeadline
  if (input.extensionEnabled) {
    const extension = input.extension
    deadline = getEffectiveDeadline(input, context)
    plan.extension = {
      newDeadline: deadline,
      totalExtensionDays: context.previousExtensionDays + extension.requestedDays,
    }
    plan.documents.push({
      tipo: 'AMPLIACION_PLAZO',
      nombre: extension.documentName.trim(),
      url: extension.documentUrl.trim(),
      radicadoNumero: extension.filingNumber.trim(),
      radicadoFecha: extension.filingDate,
    })
    plan.filings.push({
      tipo: 'Ampliación de plazo',
      numero: extension.filingNumber.trim(),
      fecha: extension.filingDate,
      documento: { nombre: extension.documentName.trim(), url: extension.documentUrl.trim() },
    })
    plan.history.push({
      action: 'Amplió el plazo de respuesta',
      detail: `${extension.requestedDays} días hábiles con el radicado ${extension.filingNumber.trim()} del ${formatDate(extension.filingDate)}, antes del vencimiento (${formatDate(context.currentDeadline)}). Nueva fecha límite: ${formatDate(deadline)}. Motivo: ${extension.reason.trim()}`,
    })
  }

  if (input.outcome === 'pending') return plan

  if (input.respondedBy && input.respondedBy.uid !== assignee?.uid) {
    plan.history.push({
      action: 'Cambio de responsable',
      detail: `${assignee?.nombreCompleto ?? 'Sin asignar'} → ${input.respondedBy.nombreCompleto}. Proyectó y firmó la ${input.outcome === 'transfer' ? 'actuación' : 'respuesta'}.`,
    })
    plan.assignee = input.respondedBy
  }

  const addFiling = (
    filing: LateFilingInput,
    tipo: 'Salida' | 'Traslado',
    documentType: WorkflowDocumentType,
  ) => {
    const number = filing.number.trim()
    const parsed = parseDocumentLink(filing.documentName, filing.documentUrl, filing.folios)
    const document = 'document' in parsed ? parsed.document : undefined
    if (document)
      plan.documents.push({
        ...document,
        tipo: documentType,
        radicadoNumero: number,
        radicadoFecha: filing.date,
      })
    plan.filings.push({
      tipo,
      numero: number,
      fecha: filing.date,
      fechaEnvio: filing.sentDate,
      documento: document
        ? { nombre: document.nombre, url: document.url }
        : context.existingDocuments[documentType],
    })
    plan.fields.numeroRadicadoActuacion = number
    plan.fields.fechaRadicadoActuacion = filing.date
    plan.fields.fechaEnvioActuacion = filing.sentDate
  }

  if (input.outcome === 'transfer') {
    const filing = input.transfer.filing
    if (scope.transferDestination) {
      const destination = input.transfer.destination.trim()
      plan.fields.trasladoPorCompetencia = true
      plan.fields.responsableExterno = destination
      plan.history.push({
        action: 'Traslado por competencia',
        detail: `${assignee?.nombreCompleto ?? 'Sin asignar'} → ${destination}`,
      })
      plan.history.push({ action: 'Motivo del traslado', detail: input.transfer.reason.trim() })
    }
    addFiling(filing, 'Traslado', 'TRASLADO')
    plan.history.push({ action: 'Registró radicado de traslado', detail: describeFiling(filing) })
    plan.transferTimeliness = evaluateTimeliness(
      filing.date,
      addBusinessDays(fromDateKey(context.entryDate), TRANSFER_TERM_DAYS, context.holidays),
      context.holidays,
    )
    plan.finalStatus = 'Generar respuesta al ciudadano'
    if (!input.citizenResponseSent) return plan
  }

  const citizen = input.outcome === 'transfer' || scope.citizenResponseOnly
  addFiling(input.response, 'Salida', 'RADICADO_SALIDA')
  plan.history.push({
    action: citizen ? 'Radicó respuesta al ciudadano' : 'Registró radicado de salida',
    detail: describeFiling(input.response),
  })
  plan.timeliness = evaluateTimeliness(input.response.date, deadline, context.holidays)
  plan.finalStatus = 'Archivo (Finalizado)'
  plan.finalized = true
  plan.closingDate = input.response.date
  plan.history.push({
    action: 'Finalizó expediente',
    detail: plan.timeliness.onTime
      ? 'Respondido dentro del término. El expediente pasó al Histórico.'
      : `Respondido ${plan.timeliness.businessDaysLate} días hábiles después del vencimiento. El expediente pasó al Histórico.`,
  })
  return plan
}

export type TimelineTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface TimelineEvent {
  date: string
  label: string
  detail?: string
  tone: TimelineTone
}

/**
 * Línea de tiempo con las fechas reales, para comprobar antes de guardar en qué estado estaba
 * el expediente en cada actuación. Solo incluye las fechas ya diligenciadas.
 */
export function buildLateTimeline(
  input: LateRegistrationInput,
  context: LateRegistrationContext,
): TimelineEvent[] {
  const holidays = context.holidays ?? []
  const events: TimelineEvent[] = [
    { date: context.entryDate, label: 'Radicado de entrada', tone: 'neutral' },
    {
      date: toDateKey(context.currentDeadline),
      label: context.previousExtensionDays ? 'Vencía (con ampliación anterior)' : 'Vencía',
      tone: 'neutral',
    },
  ]
  let deadline = context.currentDeadline
  if (input.extensionEnabled && input.extension.filingDate) {
    const onTime = input.extension.filingDate <= toDateKey(context.currentDeadline)
    events.push({
      date: input.extension.filingDate,
      label: 'Ampliación de plazo',
      detail: onTime ? 'Radicada antes del vencimiento' : 'Radicada después del vencimiento',
      tone: onTime ? 'success' : 'danger',
    })
    deadline = getEffectiveDeadline(input, context)
    if (onTime && deadline !== context.currentDeadline)
      events.push({
        date: toDateKey(deadline),
        label: 'Nueva fecha límite',
        detail: `+${input.extension.requestedDays} días hábiles`,
        tone: 'neutral',
      })
  }
  if (input.outcome === 'transfer' && input.transfer.filing.date) {
    const result = evaluateTimeliness(
      input.transfer.filing.date,
      addBusinessDays(fromDateKey(context.entryDate), TRANSFER_TERM_DAYS, holidays),
      holidays,
    )
    events.push({
      date: input.transfer.filing.date,
      label: 'Traslado por competencia',
      detail: result.onTime
        ? `Dentro de los ${TRANSFER_TERM_DAYS} días hábiles`
        : `${result.businessDaysLate} días hábiles después de los ${TRANSFER_TERM_DAYS} del art. 21`,
      tone: result.onTime ? 'success' : 'warning',
    })
  }
  if (needsResponse(input) && input.response.date) {
    const result = evaluateTimeliness(input.response.date, deadline, holidays)
    events.push({
      date: input.response.date,
      label: 'Respuesta radicada',
      detail: result.onTime
        ? 'Dentro del término'
        : `${result.businessDaysLate} días hábiles fuera del término`,
      tone: result.onTime ? 'success' : 'danger',
    })
    if (input.response.sentDate)
      events.push({ date: input.response.sentDate, label: 'Respuesta enviada', tone: 'neutral' })
  }
  // Orden estable: a igual fecha se respeta el orden del flujo.
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.date.localeCompare(b.event.date) || a.index - b.index)
    .map(({ event }) => event)
}
