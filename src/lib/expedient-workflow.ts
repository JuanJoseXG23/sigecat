import type {
  ActuationFields,
  AssignedOfficial,
  Expedient,
  ExpedientStatus,
  WorkflowDocument,
  WorkflowDocumentType,
} from '@/types/expedient'

/**
 * Reglas del flujo del expediente: qué exige cada paso y qué produce al continuar.
 * Es lógica pura y probada; la interfaz solo la muestra y los servicios la ejecutan.
 * docs/flujo-y-permisos.md describe estas mismas reglas para las personas.
 */

export const STANDARD_FLOW: ExpedientStatus[] = [
  'Recibido',
  'Asignado',
  'En respuesta',
  'Radicado de salida',
  'Archivo (Finalizado)',
]

export const TRANSFER_FLOW: ExpedientStatus[] = [
  'Recibido',
  'Asignado',
  'En respuesta',
  'Traslado por competencia',
  'Generar radicado de traslado',
  'Generar respuesta al ciudadano',
  'Radicar respuesta',
  'Archivo (Finalizado)',
]

export type ResponseChoice = 'response' | 'transfer' | 'change'

export interface StepDefinition {
  title: string
  requiresSignature: boolean
  /** Asignado: elegir responsable. */
  requiresAssignee: boolean
  /** En respuesta: responder, trasladar o cambiar de responsable. */
  offersChoice: boolean
  document?: { type: WorkflowDocumentType; description: string }
  requiresFiling: boolean
  /** Acción que queda en el historial cuando el paso registra un radicado. */
  filingAction?: string
}

const DEFAULT_STEP: StepDefinition = {
  title: 'Completar actuación',
  requiresSignature: false,
  requiresAssignee: false,
  offersChoice: false,
  requiresFiling: false,
}

const STEPS: Partial<Record<ExpedientStatus, Partial<StepDefinition>>> = {
  Recibido: {
    title: 'Confirmación de recepción',
    requiresSignature: true,
    document: {
      type: 'RECIBIDO',
      description: 'Este documento será obligatorio antes de continuar con el trámite.',
    },
  },
  Asignado: { title: 'Asignar expediente', requiresAssignee: true },
  'En respuesta': { title: 'Definir actuación', offersChoice: true },
  'Radicado de salida': {
    document: {
      type: 'RADICADO_SALIDA',
      description: 'Antes de finalizar, asocia el documento de respuesta radicada.',
    },
    requiresFiling: true,
    filingAction: 'Registró radicado de salida',
  },
  'Generar radicado de traslado': {
    document: {
      type: 'TRASLADO',
      description: 'Asocia el documento de traslado en OneDrive antes de continuar.',
    },
    requiresFiling: true,
    filingAction: 'Registró radicado de traslado',
  },
  'Radicar respuesta': {
    document: {
      type: 'RADICADO_SALIDA',
      description: 'Asocia la respuesta radicada antes de finalizar el expediente.',
    },
    requiresFiling: true,
    filingAction: 'Radicó respuesta al ciudadano',
  },
}

export function getFlow(expedient: Pick<Expedient, 'trasladoPorCompetencia'>): ExpedientStatus[] {
  return expedient.trasladoPorCompetencia ? TRANSFER_FLOW : STANDARD_FLOW
}

export function getStepDefinition(status: ExpedientStatus): StepDefinition {
  return { ...DEFAULT_STEP, ...STEPS[status] }
}

/** Lo que la persona diligencia en el diálogo de actuación. */
export interface ActuationInput {
  signed: boolean
  choice: ResponseChoice
  assignee?: AssignedOfficial
  destination: string
  reason: string
  filingNumber: string
  filingDate: string
  notes: string
}

export const EMPTY_ACTUATION_INPUT: ActuationInput = {
  signed: false,
  choice: 'response',
  destination: '',
  reason: '',
  filingNumber: '',
  filingDate: '',
  notes: '',
}

/** Primer dato pendiente de diligenciar en el paso, o null si está completo. */
function getMissingInput(status: ExpedientStatus, input: ActuationInput): string | null {
  const step = getStepDefinition(status)
  if (step.requiresSignature && !input.signed) return 'Confirma que el formato físico fue firmado.'
  if (step.requiresAssignee && !input.assignee) return 'Selecciona el responsable.'
  if (step.offersChoice && input.choice === 'change' && !input.assignee)
    return 'Selecciona el nuevo responsable.'
  if (
    step.offersChoice &&
    input.choice === 'transfer' &&
    (!input.destination.trim() || !input.reason.trim())
  )
    return 'Indica la dependencia destino y el motivo del traslado.'
  if (step.requiresFiling && (!input.filingNumber.trim() || !input.filingDate))
    return 'Registra el número y la fecha de radicado.'
  return null
}

/** Primer requisito pendiente del paso, o null si ya se puede continuar. */
export function getMissingRequirement(
  status: ExpedientStatus,
  input: ActuationInput,
  documents: Pick<WorkflowDocument, 'tipo'>[],
): string | null {
  const document = getStepDefinition(status).document
  if (document && !documents.some((item) => item.tipo === document.type))
    return 'Asocia el documento requerido en OneDrive.'
  return getMissingInput(status, input)
}

export type Actuation =
  | { kind: 'assign'; assignee: AssignedOfficial; advanceTo?: ExpedientStatus }
  | { kind: 'transfer'; destination: string; reason: string }
  | {
      kind: 'complete'
      action: string
      detail: string
      nextStatus: ExpedientStatus
      fields: ActuationFields
    }

/** Traduce el paso actual y lo diligenciado en la operación que se debe guardar. */
export function planActuation(
  expedient: Pick<Expedient, 'estado' | 'trasladoPorCompetencia'>,
  input: ActuationInput,
): Actuation {
  const status = expedient.estado
  const missing = getMissingInput(status, input)
  if (missing) throw new Error(missing)
  const notes = input.notes.trim()

  if (status === 'Recibido')
    return {
      kind: 'complete',
      action: 'Confirmó firma del formato físico',
      detail: notes || 'Formato físico firmado.',
      nextStatus: 'Asignado',
      fields: { formatoFisicoFirmado: true },
    }
  if (status === 'Asignado')
    return { kind: 'assign', assignee: input.assignee!, advanceTo: 'En respuesta' }
  if (status === 'En respuesta') {
    if (input.choice === 'change') return { kind: 'assign', assignee: input.assignee! }
    if (input.choice === 'transfer')
      return { kind: 'transfer', destination: input.destination, reason: input.reason }
    return {
      kind: 'complete',
      action: 'Seleccionó respuesta a usuario',
      detail: notes || 'Se inició la respuesta al ciudadano.',
      nextStatus: 'Radicado de salida',
      fields: {},
    }
  }

  const flow = getFlow(expedient)
  const nextStatus = flow[flow.indexOf(status) + 1]
  if (!flow.includes(status) || !nextStatus)
    throw new Error('El expediente no tiene una actuación pendiente.')
  const step = getStepDefinition(status)
  if (step.requiresFiling) {
    const number = input.filingNumber.trim()
    return {
      kind: 'complete',
      action: step.filingAction!,
      detail: `Radicado ${number}. ${notes}`.trim(),
      nextStatus,
      fields: { numeroRadicadoActuacion: number, fechaRadicadoActuacion: input.filingDate },
    }
  }
  return {
    kind: 'complete',
    action: 'Generó actuación del trámite',
    detail: notes || 'Actuación completada.',
    nextStatus,
    fields: {},
  }
}
