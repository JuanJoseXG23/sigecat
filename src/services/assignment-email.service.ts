import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { Expedient } from '@/types/expedient'
import type { UserProfile } from '@/types/user'

export async function queueAssignmentEmail(
  expedient: Pick<Expedient, 'numeroRadicado' | 'tipoTramite' | 'solicitantes' | 'predios' | 'fechaLimite'>,
  recipient: Pick<UserProfile, 'uid' | 'nombreCompleto' | 'correo'>,
): Promise<void> {
  await addDoc(collection(firestore, 'notificacionesAsignacion'), {
    destinatarioUid: recipient.uid,
    destinatarioNombre: recipient.nombreCompleto,
    destinatarioCorreo: recipient.correo,
    numeroRadicado: expedient.numeroRadicado,
    tipoTramite: expedient.tipoTramite ?? '',
    solicitante: expedient.solicitantes[0]?.nombre ?? '',
    predio: expedient.predios[0]?.direccion ?? expedient.predios[0]?.numeroPredial ?? '',
    fechaLimite: expedient.fechaLimite?.toDate().toISOString() ?? '',
    estado: 'Pendiente',
    fechaSolicitud: serverTimestamp(),
  })
}
