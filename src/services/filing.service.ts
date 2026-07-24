import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { firestore } from '@/services/firebase'

export interface FilingRecord { id: string; numero: string; fecha: string; tipo: string; expedienteId: string; solicitante: string; responsable: string; estado: string; municipio: string; observaciones?: string }
const COLLECTION = 'radicados'

export async function listFilings(): Promise<FilingRecord[]> {
  const result = await getDocs(collection(firestore, COLLECTION))
  return result.docs.map((entry) => entry.data() as FilingRecord).sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function registerFiling(data: Omit<FilingRecord, 'id'>): Promise<void> {
  const reference = doc(collection(firestore, COLLECTION))
  await setDoc(reference, { ...data, id: reference.id, creadoEn: serverTimestamp() })
}
