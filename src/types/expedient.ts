import type { Timestamp } from 'firebase/firestore'

export const EXPEDIENT_STATUSES = [
  'Recibido',
  'Asignado',
  'En respuesta',
  'Radicado de salida',
  'Traslado por competencia',
  'Generar radicado de traslado',
  'Generar respuesta al ciudadano',
  'Radicar respuesta',
  'Archivo (Finalizado)',
  // Archivo administrativo fuera del flujo, reservado a supervisores.
  'Archivado',
] as const

export const EXPEDIENT_PRIORITIES = ['Alta', 'Media', 'Baja'] as const

export const APPLICANT_TYPES = [
  'Propietario',
  'Copropietario',
  'Apoderado',
  'Representante',
  'Otro',
] as const

/** Clasificación de la información según la Ley 1712 de 2014 (transparencia). */
export const ACCESS_LEVELS = ['Pública', 'Pública clasificada', 'Pública reservada'] as const

export type ExpedientStatus = (typeof EXPEDIENT_STATUSES)[number]
export type AccessLevel = (typeof ACCESS_LEVELS)[number]
export type ExpedientPriority = (typeof EXPEDIENT_PRIORITIES)[number]
export type ApplicantType = (typeof APPLICANT_TYPES)[number]

export interface Applicant {
  nombre?: string
  documento?: string
  telefono?: string
  correo?: string
  tipoSolicitante?: ApplicantType
}

export interface Property {
  municipio?: string
  numeroPredial?: string
  matriculaInmobiliaria?: string
  direccion?: string
}

export interface AssignedOfficial {
  uid: string
  nombreCompleto: string
}

export type WorkflowDocumentType = 'RECIBIDO' | 'RADICADO_SALIDA' | 'TRASLADO' | 'AMPLIACION_PLAZO'

export const WORKFLOW_DOCUMENT_LABELS: Record<WorkflowDocumentType, string> = {
  RECIBIDO: 'Documento recibido',
  RADICADO_SALIDA: 'Respuesta radicada',
  TRASLADO: 'Documento de traslado',
  AMPLIACION_PLAZO: 'Ampliación de plazo',
}

export interface WorkflowDocument {
  id: string
  tipo: WorkflowDocumentType
  nombre: string
  url: string
  usuario: string
  fecha: Timestamp
  /** Número de folios (páginas) del documento, para la hoja de control. */
  folios?: number
  // Opcional: información de radicado asociada a este documento
  radicadoNumero?: string
  radicadoFecha?: Timestamp
}

export type WorkflowDocumentPayload = Omit<WorkflowDocument, 'id' | 'fecha' | 'radicadoFecha'> & {
  radicadoFecha?: string
}

/** Ampliación del término de respuesta, comunicada al peticionario con un radicado. */
export interface DeadlineExtension {
  numeroRadicado: string
  fechaRadicado: string
  diasSolicitados: number
  motivo: string
  documentoNombre: string
  documentoUrl: string
  fechaLimiteAnterior: Timestamp
  fechaLimiteNueva: Timestamp
  usuario: string
  fecha: Timestamp
}

/** Copia de la Tabla de Retención Documental del tipo de trámite al crear el expediente. */
export interface DocumentClassification {
  codigo?: string
  serie?: string
  subserie?: string
  retencionGestion?: number
  retencionCentral?: number
  disposicionFinal?: string
}

export interface Expedient extends ActuationFields {
  id: string
  numeroRadicado: string
  fechaRadicado: Timestamp
  fechaRecibido?: Timestamp
  medioIngreso?: string
  tipoTramiteId?: string
  tipoTramite?: string
  asunto?: string
  nivelAcceso?: AccessLevel
  /** Término inicial del tipo de trámite al momento de guardar, en días hábiles. */
  diasTermino?: number
  /** Suma de días hábiles ampliados; la fecha límite los incluye. */
  diasAmpliacion?: number
  ampliacionesPlazo?: DeadlineExtension[]
  clasificacionDocumental?: DocumentClassification
  solicitantes: Applicant[]
  predios: Property[]
  funcionarioAsignado?: AssignedOfficial
  responsableExterno?: string
  trasladoPorCompetencia?: boolean
  estado: ExpedientStatus
  prioridad?: ExpedientPriority
  fechaLimite?: Timestamp
  diasRestantes?: number
  diasVencidos?: number
  estadoTermino?: 'En plazo' | 'Próximo a vencer' | 'Vencido'
  /** Marca creada por el proceso diario para no repetir el mismo aviso. */
  ultimaAlertaVencimiento?: {
    clave: string
    fecha: Timestamp
  }
  observacionesIniciales?: string
  carpetaOneDrive?: string
  documentosWorkflow?: WorkflowDocument[]
  fechaCreacion: Timestamp
  fechaActualizacion: Timestamp
  /** Fecha en que se finalizó o archivó; inicia el tiempo de retención documental. */
  fechaCierre?: Timestamp
  creadoPor: string
  activo: boolean
}

/** Campos opcionales que una actuación del flujo puede guardar en el expediente. */
export interface ActuationFields {
  formatoFisicoFirmado?: boolean
  /** Radicado de salida o de traslado; nunca reemplaza el radicado de entrada. */
  numeroRadicadoActuacion?: string
  fechaRadicadoActuacion?: string
}

/** Fecha de cierre; los expedientes anteriores a este campo usan su última actualización. */
export function getClosingDate(item: Pick<Expedient, 'fechaCierre' | 'fechaActualizacion'>): Date {
  return (item.fechaCierre ?? item.fechaActualizacion).toDate()
}

export function isFinalizedExpedient(item: Pick<Expedient, 'estado' | 'activo'>): boolean {
  return !item.activo || item.estado === 'Archivo (Finalizado)' || item.estado === 'Archivado'
}

export interface ExpedientFormData {
  numeroRadicado: string
  fechaRadicado: string
  fechaRecibido?: string
  medioIngreso?: string
  tipoTramiteId?: string
  tipoTramite?: string
  asunto?: string
  nivelAcceso?: AccessLevel
  solicitantes: Applicant[]
  predios: Property[]
  funcionarioAsignadoUid?: string
  prioridad?: ExpedientPriority
  observacionesIniciales?: string
}

export interface ExpedientHistoryEntry {
  id: string
  usuario: string
  accion: string
  detalle: string
  fecha: Timestamp | null
}
