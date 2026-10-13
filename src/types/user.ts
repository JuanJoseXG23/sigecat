import type { Timestamp } from 'firebase/firestore'

/**
 * Directivo: la jefatura. Ve todo y el Panel de dirección, y pregunta por correo a los
 * responsables, pero no modifica expedientes.
 */
export const USER_ROLES = [
  'Administrador',
  'Coordinador',
  'Funcionario',
  'Directivo',
  'Consulta',
] as const

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
