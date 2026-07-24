import { Timestamp, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { AgendaTask, TaskStatus } from '@/types/task'
const COLLECTION = 'tareas'
export async function listTasks(): Promise<AgendaTask[]> { const result = await getDocs(collection(firestore, COLLECTION)); return result.docs.map((item) => item.data() as AgendaTask) }
export async function createTask(data: Omit<AgendaTask, 'id' | 'fechaCreacion'>): Promise<void> { const reference = doc(collection(firestore, COLLECTION)); const due = data.fechaLimite?.toDate(); await setDoc(reference, { ...data, ...(due ? { fechaLimite: Timestamp.fromDate(due) } : {}), id: reference.id, fechaCreacion: serverTimestamp() }) }
export async function moveTask(id: string, estado: TaskStatus): Promise<void> { await updateDoc(doc(firestore, COLLECTION, id), { estado, ...(estado === 'Finalizadas' ? { fechaFinalizacion: serverTimestamp() } : {}) }) }
export async function deleteTask(id: string): Promise<void> { await deleteDoc(doc(firestore, COLLECTION, id)) }
