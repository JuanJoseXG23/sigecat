import {
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { ScannedDocument } from '@/types/expedient'

const SCANNED_DOCUMENTS_COLLECTION = 'documentosEscaneados'

export async function addScannedDocument(
  expedientId: string,
  documentData: Omit<ScannedDocument, 'id' | 'fechaEscaneo' | 'creadoPor'>,
  userId: string,
): Promise<void> {
  await addDoc(collection(firestore, SCANNED_DOCUMENTS_COLLECTION), {
    ...documentData,
    expedientId,
    creadoPor: userId,
    fechaEscaneo: serverTimestamp(),
  })
}

export async function deleteScannedDocument(documentId: string): Promise<void> {
  await deleteDoc(doc(firestore, SCANNED_DOCUMENTS_COLLECTION, documentId))
}

export async function getScannedDocuments(expedientId: string): Promise<ScannedDocument[]> {
  const q = query(collection(firestore, SCANNED_DOCUMENTS_COLLECTION), where('expedientId', '==', expedientId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ScannedDocument))
}
