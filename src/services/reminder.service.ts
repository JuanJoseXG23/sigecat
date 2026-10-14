import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { toDateKey } from '@/lib/expedient-deadline'
import { getReminderError, type ReminderInput } from '@/lib/reminders'
import { firestore } from '@/services/firebase'
import type { Reminder } from '@/types/reminder'

const COLLECTION = 'recordatorios'

const toReminders = (snapshot: Awaited<ReturnType<typeof getDocs>>) =>
  snapshot.docs.map((item) => ({ ...(item.data() as Reminder), id: item.id }))

/** Recordatorios de una persona entre dos días (yyyy-mm-dd, el final excluido). */
export async function listRemindersFor(uid: string, start: string, end: string) {
  return toReminders(
    await getDocs(
      query(
        collection(firestore, COLLECTION),
        where('destinatarioUid', '==', uid),
        where('fecha', '>=', start),
        where('fecha', '<', end),
      ),
    ),
  )
}

/** Los últimos que creó una persona para otros o para sí, del más lejano al más cercano. */
export async function listRemindersCreatedBy(uid: string): Promise<Reminder[]> {
  return toReminders(
    await getDocs(
      query(
        collection(firestore, COLLECTION),
        where('creadoPor', '==', uid),
        orderBy('fecha', 'desc'),
        limit(60),
      ),
    ),
  )
}

/** Un documento por persona, en un solo lote: o se crean todos o ninguno. */
export async function createReminders(
  input: ReminderInput,
  creator: { uid: string; nombreCompleto: string },
  recipients: { uid: string; nombreCompleto: string }[],
): Promise<void> {
  const error = getReminderError(input, toDateKey(new Date()))
  if (error) throw new Error(error)
  const batch = writeBatch(firestore)
  const group = doc(collection(firestore, COLLECTION)).id
  const description = input.descripcion.trim()
  for (const recipient of recipients) {
    const reference = doc(collection(firestore, COLLECTION))
    batch.set(reference, {
      id: reference.id,
      grupo: group,
      titulo: input.titulo.trim(),
      ...(description ? { descripcion: description } : {}),
      fecha: input.fecha,
      destinatarioUid: recipient.uid,
      destinatarioNombre: recipient.nombreCompleto,
      creadoPor: creator.uid,
      creadoPorNombre: creator.nombreCompleto,
      documentos: input.documentos.map((document) => ({
        nombre: document.nombre.trim(),
        url: document.url.trim(),
      })),
      correo: 'Pendiente',
      // A quien se lo crea otra persona le llega además un aviso al asignarlo.
      ...(recipient.uid !== creator.uid ? { correoAviso: 'Pendiente' } : {}),
      hecho: false,
      fechaCreacion: serverTimestamp(),
    })
  }
  await batch.commit()
}

/** Quien lo recibe lo marca como hecho (o lo reabre). */
export async function setReminderDone(id: string, done: boolean): Promise<void> {
  await updateDoc(doc(firestore, COLLECTION, id), {
    hecho: done,
    fechaHecho: done ? serverTimestamp() : deleteField(),
  })
}

export async function deleteReminder(id: string): Promise<void> {
  await deleteDoc(doc(firestore, COLLECTION, id))
}
