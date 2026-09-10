import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { AgendaTask, TaskStatus } from '@/types/task'
const COLLECTION = 'tareas'

export async function listTasks(ownerId: string): Promise<AgendaTask[]> {
  const result = await getDocs(
    query(collection(firestore, COLLECTION), where('responsableId', '==', ownerId)),
  )
  return result.docs.map((item) => item.data() as AgendaTask)
}

export async function createTask(data: Omit<AgendaTask, 'id' | 'fechaCreacion'>): Promise<void> {
  const reference = doc(collection(firestore, COLLECTION))
  await setDoc(reference, { ...data, id: reference.id, fechaCreacion: serverTimestamp() })
}

export async function moveTask(id: string, estado: TaskStatus): Promise<void> {
  await updateDoc(doc(firestore, COLLECTION, id), {
    estado,
    ...(estado === 'Finalizadas' ? { fechaFinalizacion: serverTimestamp() } : {}),
  })
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(firestore, COLLECTION, id))
}
