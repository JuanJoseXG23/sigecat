import type { Timestamp } from 'firebase/firestore'
import type { ReminderDocument } from '@/lib/reminders'

/** Estado del correo que Apps Script envía el día del recordatorio. */
export type ReminderEmailStatus = 'Pendiente' | 'Enviado' | 'Error' | 'Omitido'

/** Un recordatorio para una persona (uno por destinatario; los de un mismo envío comparten grupo). */
export interface Reminder {
  id: string
  grupo: string
  titulo: string
  descripcion?: string
  /** yyyy-mm-dd */
  fecha: string
  destinatarioUid: string
  destinatarioNombre: string
  creadoPor: string
  creadoPorNombre: string
  documentos: ReminderDocument[]
  /** Correo del día del recordatorio. */
  correo: ReminderEmailStatus
  detalleCorreo?: string
  /** Aviso al asignarlo, solo si lo creó otra persona (los antiguos no lo tienen). */
  correoAviso?: ReminderEmailStatus
  hecho: boolean
  fechaHecho?: Timestamp
  fechaCreacion: Timestamp | null
}
