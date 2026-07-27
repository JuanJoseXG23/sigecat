import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
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

export async function registerFiling(data: Omit<FilingRecord, 'id'>): Promise<void> {
  const existing = await getDocs(collection(firestore, COLLECTION))
  const alreadyRegistered = existing.docs.some((entry) => {
    const filing = entry.data() as FilingRecord
    return filing.expedienteId === data.expedienteId && filing.numero === data.numero
  })

  if (alreadyRegistered) return

  const reference = doc(collection(firestore, COLLECTION))
  await setDoc(reference, { ...data, id: reference.id, creadoEn: serverTimestamp() })
}
export async function deleteFiling(id: string): Promise<void> {
  await deleteDoc(doc(firestore, COLLECTION, id))
}
