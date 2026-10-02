import type { Timestamp } from 'firebase/firestore'
import type { ExpedientStatus } from '@/types/expedient'

export interface ProcedureType {
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

export interface ProcedureTypeInput {
  nombre: string
  descripcion?: string
  diasRespuesta: number
  requiereVisita: boolean
  requiereRevisionJuridica: boolean
}
