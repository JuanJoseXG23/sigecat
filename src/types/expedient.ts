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
  'En Estudio',
  'Pendiente de Información',
  'Pendiente de Visita',
  'En Revisión',
  'Respondido',
  'Finalizado',
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
  estadoTermino?: 'En plazo' | 'Próximo a vencer' | 'Vencido'
  observacionesIniciales?: string
  fechaCreacion: Timestamp
  fechaActualizacion: Timestamp
  creadoPor: string
  activo: boolean
}

export const STANDARD_FLOW: ExpedientStatus[] = ['Recibido', 'Asignado', 'En respuesta', 'Radicado de salida', 'Archivo (Finalizado)']
export const TRANSFER_FLOW: ExpedientStatus[] = ['Recibido', 'Asignado', 'En respuesta', 'Traslado por competencia', 'Generar radicado de traslado', 'Generar respuesta al ciudadano', 'Radicar respuesta', 'Archivo (Finalizado)']

export function isFinalizedExpedient(item: Pick<Expedient, 'estado' | 'activo'>): boolean {
  return !item.activo || item.estado === 'Archivo (Finalizado)' || item.estado === 'Finalizado' || item.estado === 'Archivado'
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
  estado?: ExpedientStatus
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

export interface ExpedientObservation {
  id: string
  contenido: string
  creadoPor: string
  fechaCreacion: Timestamp | null
}
