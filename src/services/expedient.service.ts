import {
  Timestamp,
  collection,
  getDoc,
  deleteField,
  getDocs,
  serverTimestamp,
  setDoc,
  doc,
  updateDoc,
} from 'firebase/firestore'
import { calculateExpedientTimeline } from '@/lib/expedient-deadline'
import { firestore } from '@/services/firebase'
import type { AssignedOfficial, Expedient, ExpedientFormData } from '@/types/expedient'

const EXPEDIENTS_COLLECTION = 'expedientes'

function toTimestamp(value?: string): Timestamp | undefined {
  if (!value) return undefined
  return Timestamp.fromDate(new Date(`${value}T00:00:00`))
}

function removeEmptyFields<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

function toExpedientData(
  values: ExpedientFormData,
  assignedOfficial?: AssignedOfficial,
): Record<string, unknown> {
  const timeline = calculateExpedientTimeline(values.fechaRadicado)

  return removeEmptyFields({
    numeroRadicado: values.numeroRadicado.trim(),
    fechaRadicado: toTimestamp(values.fechaRadicado),
    fechaRecibido: toTimestamp(values.fechaRecibido),
    medioIngreso: values.medioIngreso?.trim(),
    tipoTramite: values.tipoTramite?.trim(),
    solicitantes: values.solicitantes.map((applicant) => removeEmptyFields(applicant)),
    predios: values.predios.map((property) => removeEmptyFields(property)),
    funcionarioAsignado: assignedOfficial,
    estado: values.estado ?? 'Recibido',
    prioridad: values.prioridad,
    fechaLimite: Timestamp.fromDate(timeline.fechaLimite),
    diasRestantes: timeline.diasRestantes,
    observacionesIniciales: values.observacionesIniciales?.trim(),
  })
}

export async function listExpedients(): Promise<Expedient[]> {
  const snapshot = await getDocs(collection(firestore, EXPEDIENTS_COLLECTION))
  return snapshot.docs
    .map((item) => item.data() as Expedient)
    .filter((item) => item.activo)
    .sort(
      (first, second) => second.fechaActualizacion.toMillis() - first.fechaActualizacion.toMillis(),
    )
}

export async function getExpedient(id: string): Promise<Expedient | null> {
  const snapshot = await getDoc(doc(firestore, EXPEDIENTS_COLLECTION, id))
  return snapshot.exists() ? (snapshot.data() as Expedient) : null
}

export async function createExpedient(
  values: ExpedientFormData,
  createdBy: string,
  assignedOfficial?: AssignedOfficial,
): Promise<void> {
  const reference = doc(collection(firestore, EXPEDIENTS_COLLECTION))
  await setDoc(reference, {
    ...toExpedientData(values, assignedOfficial),
    id: reference.id,
    creadoPor: createdBy,
    activo: true,
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  })
}

export async function updateExpedient(
  id: string,
  values: ExpedientFormData,
  assignedOfficial?: AssignedOfficial,
): Promise<void> {
  await updateDoc(doc(firestore, EXPEDIENTS_COLLECTION, id), {
    ...toExpedientData(values, assignedOfficial),
    fechaRecibido: values.fechaRecibido ? toTimestamp(values.fechaRecibido) : deleteField(),
    medioIngreso: values.medioIngreso?.trim() || deleteField(),
    tipoTramite: values.tipoTramite?.trim() || deleteField(),
    funcionarioAsignado: assignedOfficial ?? deleteField(),
    prioridad: values.prioridad ?? deleteField(),
    observacionesIniciales: values.observacionesIniciales?.trim() || deleteField(),
    fechaActualizacion: serverTimestamp(),
  })
}

export async function archiveExpedient(id: string): Promise<void> {
  await updateDoc(doc(firestore, EXPEDIENTS_COLLECTION, id), {
    activo: false,
    estado: 'Archivado',
    fechaActualizacion: serverTimestamp(),
  })
}
