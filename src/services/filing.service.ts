import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  type QuerySnapshot,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore'
import { firestore } from '@/services/firebase'

export interface FilingRecord {
  id: string
  numero: string
  fecha: string
  tipo: string
  expedienteId: string
  /** Radicado de entrada del expediente; los registros antiguos no lo tienen. */
  expedienteRadicado?: string
  solicitante: string
  responsable: string
  estado: string
  municipio: string
  observaciones?: string
  documentoUrl?: string
  documentoNombre?: string
}
const COLLECTION = 'radicados'

function toFilings(snapshot: QuerySnapshot): FilingRecord[] {
  return snapshot.docs
    .map((entry) => entry.data() as FilingRecord)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function listFilings(): Promise<FilingRecord[]> {
  return toFilings(await getDocs(collection(firestore, COLLECTION)))
}

export async function listExpedientFilings(expedientId: string): Promise<FilingRecord[]> {
  return toFilings(
    await getDocs(
      query(collection(firestore, COLLECTION), where('expedienteId', '==', expedientId)),
    ),
  )
}

export function getFilingReference(expedientId: string, number: string): DocumentReference {
  return doc(firestore, COLLECTION, `${expedientId}_${encodeURIComponent(number.trim())}`)
}

export function registerFiling(batch: WriteBatch, data: Omit<FilingRecord, 'id'>): void {
  const reference = getFilingReference(data.expedienteId, data.numero)
  batch.set(reference, { ...data, id: reference.id, creadoEn: serverTimestamp() })
}
