import { FirebaseError } from 'firebase/app'
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { getInquiryError } from '@/lib/inquiry'
import { firestore } from '@/services/firebase'
import type { Expedient } from '@/types/expedient'

const COLLECTION = 'consultasDireccion'

export type InquiryStatus = 'Pendiente' | 'Enviado' | 'Error' | 'Omitido'

/** Pregunta de la jefatura al responsable de un expediente; Apps Script la envía por correo. */
export interface ExpedientInquiry {
  id: string
  expedienteId: string
  expedienteRadicado: string
  destinatarioUid: string
  destinatarioNombre: string
  solicitadoPor: string
  pregunta: string
  estado: InquiryStatus
  fechaSolicitud: Timestamp | null
  fechaProcesamiento?: Timestamp
  detalleError?: string
}

/**
 * Deja la pregunta en cola. Las reglas exigen que el destinatario sea el responsable actual
 * del expediente; el correo y el contenido final los arma Apps Script desde Firestore.
 */
export async function askAboutExpedient(
  expedient: Pick<Expedient, 'id' | 'numeroRadicado' | 'funcionarioAsignado'>,
  question: string,
  userId: string,
): Promise<void> {
  const recipient = expedient.funcionarioAsignado
  const error = getInquiryError(question, recipient)
  if (error) throw new Error(error)
  try {
    await addDoc(collection(firestore, COLLECTION), {
      expedienteId: expedient.id,
      expedienteRadicado: expedient.numeroRadicado,
      destinatarioUid: recipient!.uid,
      destinatarioNombre: recipient!.nombreCompleto,
      solicitadoPor: userId,
      pregunta: question.trim(),
      estado: 'Pendiente',
      fechaSolicitud: serverTimestamp(),
    })
  } catch (cause) {
    if (cause instanceof FirebaseError && cause.code === 'permission-denied')
      throw new Error(
        'No fue posible enviar la pregunta: el responsable pudo cambiar. Recarga e intenta de nuevo.',
      )
    throw cause
  }
}

/** Preguntas que hizo esta persona, de la más reciente a la más antigua. */
export async function listMyInquiries(userId: string): Promise<ExpedientInquiry[]> {
  const snapshot = await getDocs(
    query(collection(firestore, COLLECTION), where('solicitadoPor', '==', userId)),
  )
  return snapshot.docs
    .map((item) => ({ ...(item.data() as Omit<ExpedientInquiry, 'id'>), id: item.id }))
    .sort((a, b) => (b.fechaSolicitud?.toMillis() ?? 0) - (a.fechaSolicitud?.toMillis() ?? 0))
}
