import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { firestore } from '@/services/firebase'

export async function requestEmailTest(recipient: { nombre: string; correo: string }, requestedBy: string): Promise<void> {
  await addDoc(collection(firestore, 'solicitudesPruebaCorreo'), {
    destinatarioNombre: recipient.nombre,
    destinatarioCorreo: recipient.correo,
    solicitadoPor: requestedBy,
    estado: 'Pendiente',
    fechaSolicitud: serverTimestamp(),
  })
}
