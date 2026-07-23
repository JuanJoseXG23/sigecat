import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { ProcedureType, ProcedureTypeInput } from '@/types/procedure-type'

const COLLECTION = 'tiposTramite'

export async function listProcedureTypes(): Promise<ProcedureType[]> {
  const result = await getDocs(collection(firestore, COLLECTION))
  return result.docs.map((item) => item.data() as ProcedureType).filter((item) => item.activo).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function saveProcedureType(values: ProcedureTypeInput, id?: string): Promise<void> {
  const reference = id ? doc(firestore, COLLECTION, id) : doc(collection(firestore, COLLECTION))
  const data = { ...values, nombre: values.nombre.trim(), descripcion: values.descripcion?.trim() ?? '', fechaActualizacion: serverTimestamp() }
  if (id) await updateDoc(reference, data)
  else await setDoc(reference, { ...data, id: reference.id, activo: true, fechaCreacion: serverTimestamp() })
}

export async function deactivateProcedureType(id: string): Promise<void> {
  await updateDoc(doc(firestore, COLLECTION, id), { activo: false, fechaActualizacion: serverTimestamp() })
}
