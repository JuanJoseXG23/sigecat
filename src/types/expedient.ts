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

export type ExpedientStatus = (typeof EXPEDIENT_STATUSES)[number]
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

export type WorkflowDocumentType = 'RECIBIDO' | 'RADICADO_SALIDA' | 'TRASLADO'

export interface WorkflowDocument {
  id: string
  tipo: WorkflowDocumentType
  nombre: string
  url: string
  usuario: string
  fecha: Timestamp
  // Opcional: información de radicado asociada a este documento
  radicadoNumero?: string
  radicadoFecha?: Timestamp
}

export type WorkflowDocumentPayload = Omit<WorkflowDocument, 'id' | 'fecha' | 'radicadoFecha'> & {
  radicadoFecha?: string
}

export interface Expedient {
  id: string
  numeroRadicado: string
  fechaRadicado: Timestamp
  fechaRecibido?: Timestamp
  medioIngreso?: string
  tipoTramiteId?: string
  tipoTramite?: string
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
  creadoPor: string
  activo: boolean
}

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
