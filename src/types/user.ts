import type { Timestamp } from 'firebase/firestore'

export const USER_ROLES = ['Administrador', 'Coordinador', 'Funcionario', 'Consulta'] as const

export type UserRole = (typeof USER_ROLES)[number]

export interface UserProfile {
  uid: string
  nombreCompleto: string
  correo: string
  cargo: string
  dependencia?: string
  rol: UserRole
  activo: boolean
  /** Indica si el funcionario acepta recibir alertas de vencimiento por correo. */
  recibeAlertasVencimiento?: boolean
  fechaCreacion: Timestamp
  ultimoIngreso: Timestamp | null
}
