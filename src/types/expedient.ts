import type { Timestamp } from 'firebase/firestore'
import type { DependencyId } from '@/lib/dependencies'

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

export interface Expedient extends ActuationFields {
  id: string
  /** Área que lidera el expediente; los anteriores a las dependencias son de Catastro. */
  dependencia?: DependencyId
  /**
   * Quienes registraron, tuvieron asignado o actuaron sobre el expediente. Solo crece: con la
   * separación por dependencias, un Funcionario verá los expedientes donde figura.
   */
  participantes?: string[]
  numeroRadicado: string
  fechaRadicado: Timestamp
  fechaRecibido?: Timestamp
  medioIngreso?: string
  tipoTramiteId?: string
  tipoTramite?: string
  asunto?: string
  /** Término inicial del tipo de trámite al momento de guardar, en días hábiles. */
  diasTermino?: number
  /** Suma de días hábiles ampliados; la fecha límite los incluye. */
  diasAmpliacion?: number
  ampliacionesPlazo?: DeadlineExtension[]
  registrosTardios?: LateRegistrationRecord[]
  apoyosRespuesta?: ResponseSupport[]
  solicitantes: Applicant[]
  /** Opcional: los expedientes no tienen que identificar predios. */
  predios?: Property[]
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
  /** Fecha en que se finalizó o archivó el expediente. */
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
  /** Fecha en que se envió o notificó la actuación radicada (yyyy-mm-dd). */
  fechaEnvioActuacion?: string
}

/** Apoyo de otra área en la respuesta; el expediente no cambia de área ni de responsable. */
export interface ResponseSupport {
  dependencia: DependencyId
  persona: string
  /** uid de quien apoyó, si tiene usuario: lo deja consultar el expediente. */
  personaUid?: string
  descripcion: string
  /** uid de quien lo registró. */
  usuario: string
  fecha: Timestamp
}

/** Actuaciones hechas a tiempo en la oficina que se subieron después a la aplicación. */
export interface LateRegistrationRecord {
  motivo: string
  usuario: string
  fecha: Timestamp
}

/** Fecha de cierre; los expedientes anteriores a este campo usan su última actualización. */
export function getClosingDate(item: Pick<Expedient, 'fechaCierre' | 'fechaActualizacion'>): Date {
  return (item.fechaCierre ?? item.fechaActualizacion).toDate()
}

/**
 * Fecha con la que se mide si se respondió a tiempo: la del radicado de la respuesta que cerró
 * el expediente, que puede ser anterior al día en que se registró en la aplicación.
 */
export function getResponseDate(
  item: Pick<Expedient, 'estado' | 'fechaRadicadoActuacion' | 'fechaCierre' | 'fechaActualizacion'>,
): Date {
  if (item.estado === 'Archivo (Finalizado)' && item.fechaRadicadoActuacion) {
    const [year, month, day] = item.fechaRadicadoActuacion.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  return getClosingDate(item)
}

export function isFinalizedExpedient(item: Pick<Expedient, 'estado' | 'activo'>): boolean {
  return !item.activo || item.estado === 'Archivo (Finalizado)' || item.estado === 'Archivado'
}

export interface ExpedientFormData {
  dependencia: DependencyId
  numeroRadicado: string
  fechaRadicado: string
  fechaRecibido?: string
  medioIngreso?: string
  tipoTramiteId?: string
  tipoTramite?: string
  asunto?: string
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
