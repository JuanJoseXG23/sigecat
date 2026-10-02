import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { ProcedureType, ProcedureTypeInput } from '@/types/procedure-type'
import { STANDARD_FLOW } from '@/types/expedient'

const COLLECTION = 'tiposTramite'

export async function listProcedureTypes(): Promise<ProcedureType[]> {
  const result = await getDocs(collection(firestore, COLLECTION))
  return result.docs.map((item) => item.data() as ProcedureType).filter((item) => item.activo).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function getActiveProcedureType(id?: string): Promise<ProcedureType | null> {
  if (!id) return null
  const result = await getDoc(doc(firestore, COLLECTION, id))
  if (!result.exists()) return null
  const type = result.data() as ProcedureType
  return type.activo ? type : null
}

export async function saveProcedureType(values: ProcedureTypeInput, id?: string): Promise<void> {
  const reference = id ? doc(firestore, COLLECTION, id) : doc(collection(firestore, COLLECTION))
  const data = { ...values, flujoEstados: STANDARD_FLOW, nombre: values.nombre.trim(), descripcion: values.descripcion?.trim() ?? '', fechaActualizacion: serverTimestamp() }
  if (id) await updateDoc(reference, data)
  else await setDoc(reference, { ...data, id: reference.id, activo: true, fechaCreacion: serverTimestamp() })
}

export async function deactivateProcedureType(id: string): Promise<void> {
  await updateDoc(doc(firestore, COLLECTION, id), { activo: false, fechaActualizacion: serverTimestamp() })
}

export async function resetProcedureTypeCatalog(): Promise<void> {
  const result = await getDocs(collection(firestore, COLLECTION))
  const batch = writeBatch(firestore)
  result.docs.forEach((item) => batch.update(item.ref, { activo: false, fechaActualizacion: serverTimestamp() }))
  await batch.commit()
}
