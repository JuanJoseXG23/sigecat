import type { Timestamp } from 'firebase/firestore'

export const USER_ROLES = ['Administrador', 'Coordinador', 'Funcionario', 'Consulta'] as const

export type UserRole = (typeof USER_ROLES)[number]

export interface UserProfile {
  uid: string
  nombreCompleto: string
  correo: string
  cargo: string
  rol: UserRole
  activo: boolean
  fechaCreacion: Timestamp
  ultimoIngreso: Timestamp | null
}
