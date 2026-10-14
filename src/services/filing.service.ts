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
  /** Solo en radicados antiguos: venía del primer predio, que ya no es obligatorio. */
  municipio?: string
  observaciones?: string
  documentoUrl?: string
  documentoNombre?: string
  /** Fecha en que se envió o notificó al destinatario. */
  fechaEnvio?: string
  /** Se subió a la aplicación después de radicado (registro tardío). */
  registroTardio?: boolean
}
const COLLECTION = 'radicados'

function toFilings(snapshot: QuerySnapshot): FilingRecord[] {
  return snapshot.docs
    .map((entry) => entry.data() as FilingRecord)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/**
 * Las reglas comparan cada radicado con su expediente, y una consulta solo puede consultar
 * unos pocos expedientes: por eso se piden en grupos de este tamaño.
 */
const FILINGS_PER_QUERY = 10

/**
 * Todos los radicados; con `participant`, solo los de los expedientes donde figura esa
 * persona, que es lo único que las reglas le dejan ver a un Funcionario.
 */
export async function listFilings(participant?: string): Promise<FilingRecord[]> {
  if (!participant) return toFilings(await getDocs(collection(firestore, COLLECTION)))
  const expedients = await getDocs(
    query(
      collection(firestore, 'expedientes'),
      where('participantes', 'array-contains', participant),
    ),
  )
  const ids = expedients.docs.map((item) => item.id)
  const groups = Array.from({ length: Math.ceil(ids.length / FILINGS_PER_QUERY) }, (_, index) =>
    ids.slice(index * FILINGS_PER_QUERY, (index + 1) * FILINGS_PER_QUERY),
  )
  const snapshots = await Promise.all(
    groups.map((group) =>
      getDocs(query(collection(firestore, COLLECTION), where('expedienteId', 'in', group))),
    ),
  )
  return snapshots
    .flatMap((snapshot) => snapshot.docs.map((entry) => entry.data() as FilingRecord))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
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
