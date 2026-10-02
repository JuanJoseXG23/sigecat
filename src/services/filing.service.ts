import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { Expedient } from '@/types/expedient'

export interface FilingRecord {
  id: string
  numero: string
  fecha: string
  tipo: string
  expedienteId: string
  solicitante: string
  responsable: string
  estado: string
  municipio: string
  observaciones?: string
  documentoUrl?: string
  documentoNombre?: string
}
const COLLECTION = 'radicados'

export async function listFilings(): Promise<FilingRecord[]> {
  const [filingsSnapshot, expedientsSnapshot] = await Promise.all([
    getDocs(collection(firestore, COLLECTION)),
    getDocs(collection(firestore, 'expedientes')),
  ])
  const expedients = new Map(
    expedientsSnapshot.docs.map((snapshot) => [
      snapshot.id,
      { ...snapshot.data(), id: snapshot.id } as Expedient,
    ]),
  )

  return filingsSnapshot.docs
    .map((entry) => entry.data() as FilingRecord)
    .map((filing) => {
      if (filing.documentoUrl) return filing

      const expedient = expedients.get(filing.expedienteId)
      const document = expedient?.documentosWorkflow?.find(
        (item) => item.radicadoNumero === filing.numero,
      )
      return document
        ? { ...filing, documentoUrl: document.url, documentoNombre: document.nombre }
        : filing
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export function getFilingReference(expedientId: string, number: string): DocumentReference {
  return doc(firestore, COLLECTION, `${expedientId}_${encodeURIComponent(number.trim())}`)
}

export function registerFiling(batch: WriteBatch, data: Omit<FilingRecord, 'id'>): void {
  const reference = getFilingReference(data.expedienteId, data.numero)
  batch.set(reference, { ...data, id: reference.id, creadoEn: serverTimestamp() })
}
