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
import { calculateDeadline, getBusinessConfiguration, getDeadlineStatus, registerExpedientHistory } from '@/services/business-rules.service'
import { firestore } from '@/services/firebase'
import { getActiveProcedureType } from '@/services/procedure-type.service'
import type { Applicant, AssignedOfficial, Expedient, ExpedientFormData, ExpedientHistoryEntry, ExpedientObservation, ExpedientPriority, ExpedientStatus, Property } from '@/types/expedient'

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

async function toExpedientData(
  values: ExpedientFormData,
  assignedOfficial?: AssignedOfficial,
): Promise<Record<string, unknown>> {
  const [procedureType, configuration] = await Promise.all([
    getActiveProcedureType(values.tipoTramiteId),
    getBusinessConfiguration(),
  ])
  const responseDays = procedureType?.diasRespuesta ?? 15
  const fechaLimite = calculateDeadline(values.fechaRadicado, responseDays, configuration.diasFestivos)
  const timeline = getDeadlineStatus(fechaLimite, configuration.diasFestivos, configuration.umbralProximoVencer)

  return removeEmptyFields({
    numeroRadicado: values.numeroRadicado.trim(),
    fechaRadicado: toTimestamp(values.fechaRadicado),
    fechaRecibido: toTimestamp(values.fechaRecibido),
    medioIngreso: values.medioIngreso?.trim(),
    tipoTramiteId: procedureType?.id,
    tipoTramite: procedureType?.nombre ?? values.tipoTramite?.trim(),
    solicitantes: values.solicitantes.map((applicant) => removeEmptyFields(applicant)),
    predios: values.predios.map((property) => removeEmptyFields(property)),
    funcionarioAsignado: assignedOfficial,
    estado: values.estado ?? 'Recibido',
    prioridad: values.prioridad,
    fechaLimite,
    diasRestantes: timeline.diasRestantes,
    estadoTermino: timeline.estadoTermino,
    observacionesIniciales: values.observacionesIniciales?.trim(),
  })
}

export async function listExpedients(): Promise<Expedient[]> {
  const snapshot = await getDocs(collection(firestore, EXPEDIENTS_COLLECTION))
  const configuration = await getBusinessConfiguration()
  return snapshot.docs
    .map((item) => item.data() as Expedient)
    .filter((item) => item.activo)
    .map((item) => item.fechaLimite ? { ...item, ...getDeadlineStatus(item.fechaLimite, configuration.diasFestivos, configuration.umbralProximoVencer) } : item)
    .sort(
      (first, second) => second.fechaActualizacion.toMillis() - first.fechaActualizacion.toMillis(),
    )
}

export async function getExpedient(id: string): Promise<Expedient | null> {
  const snapshot = await getDoc(doc(firestore, EXPEDIENTS_COLLECTION, id))
  if (!snapshot.exists()) return null
  const item = snapshot.data() as Expedient
  if (!item.fechaLimite) return item
  const configuration = await getBusinessConfiguration()
  return { ...item, ...getDeadlineStatus(item.fechaLimite, configuration.diasFestivos, configuration.umbralProximoVencer) }
}

export async function createExpedient(
  values: ExpedientFormData,
  createdBy: string,
  assignedOfficial?: AssignedOfficial,
): Promise<void> {
  const reference = doc(collection(firestore, EXPEDIENTS_COLLECTION))
  await setDoc(reference, {
    ...(await toExpedientData(values, assignedOfficial)),
    id: reference.id,
    creadoPor: createdBy,
    activo: true,
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  })
  await registerExpedientHistory(reference.id, createdBy, 'Creación del expediente')
}

export async function updateExpedient(
  id: string,
  values: ExpedientFormData,
  userId: string,
  assignedOfficial?: AssignedOfficial,
): Promise<void> {
  const current = await getExpedient(id)
  const data = await toExpedientData(values, assignedOfficial)
  await updateDoc(doc(firestore, EXPEDIENTS_COLLECTION, id), {
    ...data,
    fechaRecibido: values.fechaRecibido ? toTimestamp(values.fechaRecibido) : deleteField(),
    medioIngreso: values.medioIngreso?.trim() || deleteField(),
    tipoTramite: values.tipoTramite?.trim() || deleteField(),
    funcionarioAsignado: assignedOfficial ?? deleteField(),
    prioridad: values.prioridad ?? deleteField(),
    observacionesIniciales: values.observacionesIniciales?.trim() || deleteField(),
    fechaActualizacion: serverTimestamp(),
  })
  if (current) {
    const changes = [
      current.estado !== data.estado && `Estado: ${current.estado} → ${data.estado}`,
      current.funcionarioAsignado?.uid !== assignedOfficial?.uid && `Responsable: ${current.funcionarioAsignado?.nombreCompleto ?? 'Sin asignar'} → ${assignedOfficial?.nombreCompleto ?? 'Sin asignar'}`,
      current.prioridad !== data.prioridad && `Prioridad: ${current.prioridad ?? 'Sin prioridad'} → ${data.prioridad ?? 'Sin prioridad'}`,
    ].filter(Boolean)
    await registerExpedientHistory(id, userId, changes.length ? 'Edición del expediente' : 'Actualización del expediente', changes.join('. '))
  }
}

export async function archiveExpedient(id: string, userId: string): Promise<void> {
  await updateDoc(doc(firestore, EXPEDIENTS_COLLECTION, id), {
    activo: false,
    estado: 'Archivado',
    fechaActualizacion: serverTimestamp(),
  })
  await registerExpedientHistory(id, userId, 'Archivo del expediente')
}

export async function updateExpedientStatus(id: string, status: ExpedientStatus, userId: string): Promise<void> {
  const current = await getExpedient(id)
  if (!current || current.estado === status) return
  await updateDoc(doc(firestore, EXPEDIENTS_COLLECTION, id), { estado: status, fechaActualizacion: serverTimestamp() })
  await registerExpedientHistory(id, userId, 'Cambio de estado', `${current.estado} → ${status}`)
}

export async function updateExpedientPriority(id: string, priority: ExpedientPriority | undefined, userId: string): Promise<void> {
  const current = await getExpedient(id)
  await updateDoc(doc(firestore, EXPEDIENTS_COLLECTION, id), { prioridad: priority ?? deleteField(), fechaActualizacion: serverTimestamp() })
  await registerExpedientHistory(id, userId, 'Cambio de prioridad', `${current?.prioridad ?? 'Sin prioridad'} → ${priority ?? 'Sin prioridad'}`)
}

export async function updateExpedientAssignee(id: string, assignee: AssignedOfficial | undefined, userId: string): Promise<void> {
  const current = await getExpedient(id)
  await updateDoc(doc(firestore, EXPEDIENTS_COLLECTION, id), { funcionarioAsignado: assignee ?? deleteField(), fechaActualizacion: serverTimestamp() })
  await registerExpedientHistory(id, userId, 'Cambio de responsable', `${current?.funcionarioAsignado?.nombreCompleto ?? 'Sin asignar'} → ${assignee?.nombreCompleto ?? 'Sin asignar'}`)
}

export async function updateExpedientApplicants(id: string, applicants: Applicant[], userId: string): Promise<void> {
  await updateDoc(doc(firestore, EXPEDIENTS_COLLECTION, id), { solicitantes: applicants.map(removeEmptyFields), fechaActualizacion: serverTimestamp() })
  await registerExpedientHistory(id, userId, 'Actualización de solicitantes', 'Se registraron altas o bajas de solicitantes.')
}

export async function updateExpedientProperties(id: string, properties: Property[], userId: string): Promise<void> {
  await updateDoc(doc(firestore, EXPEDIENTS_COLLECTION, id), { predios: properties.map(removeEmptyFields), fechaActualizacion: serverTimestamp() })
  await registerExpedientHistory(id, userId, 'Actualización de predios', 'Se registraron altas o bajas de predios.')
}

export async function addExpedientObservation(id: string, content: string, userId: string): Promise<void> {
  await setDoc(doc(collection(firestore, EXPEDIENTS_COLLECTION, id, 'observaciones')), { contenido: content.trim(), creadoPor: userId, fechaCreacion: serverTimestamp() })
  await registerExpedientHistory(id, userId, 'Nueva observación')
}

export async function listExpedientHistory(id: string): Promise<ExpedientHistoryEntry[]> {
  const result = await getDocs(collection(firestore, EXPEDIENTS_COLLECTION, id, 'historial'))
  return result.docs.map((item) => ({ id: item.id, ...item.data() }) as ExpedientHistoryEntry).sort((a, b) => (b.fecha?.toMillis() ?? 0) - (a.fecha?.toMillis() ?? 0))
}

export async function listExpedientObservations(id: string): Promise<ExpedientObservation[]> {
  const result = await getDocs(collection(firestore, EXPEDIENTS_COLLECTION, id, 'observaciones'))
  return result.docs.map((item) => ({ id: item.id, ...item.data() }) as ExpedientObservation).sort((a, b) => (b.fechaCreacion?.toMillis() ?? 0) - (a.fechaCreacion?.toMillis() ?? 0))
}
