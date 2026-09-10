import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { firestore } from '@/services/firebase'

export interface EmailTestRequest {
  estado: 'Pendiente' | 'Enviado' | 'Error'
  detalleError?: string
}

export async function requestEmailTest(
  recipient: { nombre: string; correo: string },
  requestedBy: { uid: string; correo: string },
): Promise<string> {
  const reference = await addDoc(collection(firestore, 'solicitudesPruebaCorreo'), {
    destinatarioNombre: recipient.nombre,
    destinatarioCorreo: recipient.correo,
    solicitadoPor: requestedBy.uid,
    solicitadoPorCorreo: requestedBy.correo,
    estado: 'Pendiente',
    fechaSolicitud: serverTimestamp(),
  })
  return reference.id
}

export async function getEmailTestRequest(id: string): Promise<EmailTestRequest | null> {
  const snapshot = await getDoc(doc(firestore, 'solicitudesPruebaCorreo', id))
  return snapshot.exists() ? (snapshot.data() as EmailTestRequest) : null
}
