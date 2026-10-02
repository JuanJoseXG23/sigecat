import { collection, doc, serverTimestamp, type WriteBatch } from 'firebase/firestore'
import { firestore } from '@/services/firebase'

/**
 * Encola el aviso de asignación dentro del mismo lote que asigna el expediente.
 * Solo se guardan identificadores: Apps Script obtiene el correo del perfil del
 * usuario y el contenido del expediente, así el cliente no puede dictar a quién
 * ni qué se envía desde la cuenta institucional.
 */
export function queueAssignmentEmail(
  batch: WriteBatch,
  expedientId: string,
  recipientUid: string,
  requestedBy: string,
): void {
  batch.set(doc(collection(firestore, 'notificacionesAsignacion')), {
    expedienteId: expedientId,
    destinatarioUid: recipientUid,
    solicitadoPor: requestedBy,
    estado: 'Pendiente',
    fechaSolicitud: serverTimestamp(),
  })
}
