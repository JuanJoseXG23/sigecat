import type { Timestamp } from 'firebase/firestore'

export const EXPEDIENT_STATUSES = [
  'Recibido',
  'Asignado',
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
  tipoTramite?: string
  solicitantes: Applicant[]
  predios: Property[]
  funcionarioAsignado?: AssignedOfficial
  estado: ExpedientStatus
  prioridad?: ExpedientPriority
  fechaLimite?: Timestamp
  diasRestantes?: number
  observacionesIniciales?: string
  fechaCreacion: Timestamp
  fechaActualizacion: Timestamp
  creadoPor: string
  activo: boolean
}

export interface ExpedientFormData {
  numeroRadicado: string
  fechaRadicado: string
  fechaRecibido?: string
  medioIngreso?: string
  tipoTramite?: string
  solicitantes: Applicant[]
  predios: Property[]
  funcionarioAsignadoUid?: string
  estado?: ExpedientStatus
  prioridad?: ExpedientPriority
  fechaLimite?: string
  diasRestantes?: number
  observacionesIniciales?: string
}
