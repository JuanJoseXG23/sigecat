import type { Timestamp } from 'firebase/firestore'
import type { ExpedientStatus } from '@/types/expedient'

/** Disposición final de la Tabla de Retención Documental (Acuerdo 004 de 2019, AGN). */
export const FINAL_DISPOSITIONS = [
  'Conservación total',
  'Eliminación',
  'Selección',
  'Digitalización',
] as const

/** Campos de la Tabla de Retención Documental (TRD) de la serie del trámite. */
export interface RetentionFields {
  codigoTRD?: string
  serie?: string
  subserie?: string
  /** Años en el archivo de gestión, contados desde el cierre del expediente. */
  retencionGestion?: number
  /** Años en el archivo central, después de la transferencia primaria. */
  retencionCentral?: number
  disposicionFinal?: (typeof FINAL_DISPOSITIONS)[number]
}

export interface ProcedureType extends RetentionFields {
  id: string
  nombre: string
  descripcion?: string
  diasRespuesta: number
  requiereVisita: boolean
  requiereRevisionJuridica: boolean
  flujoEstados: ExpedientStatus[]
  activo: boolean
  fechaCreacion: Timestamp
  fechaActualizacion: Timestamp
}

export interface ProcedureTypeInput extends RetentionFields {
  nombre: string
  descripcion?: string
  diasRespuesta: number
  requiereVisita: boolean
  requiereRevisionJuridica: boolean
}
