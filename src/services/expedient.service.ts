import { FirebaseError } from 'firebase/app'
import {
  Timestamp,
  collection,
  getDoc,
  deleteField,
  getDocs,
  query,
  serverTimestamp,
  doc,
  where,
  arrayUnion,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import {
  calculateDeadline,
  getBusinessConfiguration,
  getDeadlineStatus,
  registerExpedientHistory,
} from '@/services/business-rules.service'
import { toDateKey } from '@/lib/expedient-deadline'
import type { Actuation } from '@/lib/expedient-workflow'
import { firestore } from '@/services/firebase'
import { getActiveProcedureType } from '@/services/procedure-type.service'
import { getFilingReference, registerFiling } from '@/services/filing.service'
import { queueAssignmentEmail } from '@/services/assignment-email.service'
import type {
  ActuationFields,
  AssignedOfficial,
  Expedient,
  ExpedientFormData,
  ExpedientHistoryEntry,
  ExpedientStatus,
  WorkflowDocument,
  WorkflowDocumentPayload,
} from '@/types/expedient'
import { isFinalizedExpedient } from '@/types/expedient'

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

function expedientReference(id: string) {
  return doc(firestore, EXPEDIENTS_COLLECTION, id)
}

/** Confirma el lote y traduce el rechazo de las reglas a un mensaje comprensible. */
async function commit(batch: WriteBatch): Promise<void> {
  try {
    await batch.commit()
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      throw new Error('No tienes permisos para realizar esta acción sobre el expediente.')
    }
    throw error
  }
}

async function ensureUniqueFilingNumber(number: string, currentId?: string): Promise<void> {
  const snapshot = await getDocs(
    query(collection(firestore, EXPEDIENTS_COLLECTION), where('numeroRadicado', '==', number)),
  )
  if (snapshot.docs.some((item) => item.id !== currentId)) {
    throw new Error(`Ya existe un expediente con el número de radicado ${number}.`)
  }
}

async function toExpedientData(
  values: ExpedientFormData,
  assignedOfficial?: AssignedOfficial,
): Promise<Record<string, unknown>> {
  const [procedureType, configuration] = await Promise.all([
    getActiveProcedureType(values.tipoTramiteId),
    getBusinessConfiguration(),
  ])
  if (!procedureType) throw new Error('Debes seleccionar un tipo de trámite activo.')
  const responseDays = procedureType.diasRespuesta
  const fechaLimite = calculateDeadline(
    values.fechaRadicado,
    responseDays,
    configuration.diasFestivos,
  )
  const timeline = getDeadlineStatus(
    fechaLimite,
    configuration.diasFestivos,
    configuration.umbralProximoVencer,
  )

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
    prioridad: values.prioridad,
    fechaLimite,
    diasRestantes: timeline.diasRestantes,
    diasVencidos: timeline.diasVencidos,
    estadoTermino: timeline.estadoTermino,
    observacionesIniciales: values.observacionesIniciales?.trim(),
  })
}

export async function listExpedients(): Promise<Expedient[]> {
  const snapshot = await getDocs(
    query(collection(firestore, EXPEDIENTS_COLLECTION), where('activo', '==', true)),
  )
  const configuration = await getBusinessConfiguration()
  return snapshot.docs
    .map((item) => {
      const data = item.data() as Expedient
      return { ...data, id: item.id }
    })
    .filter((item) => item.activo && !isFinalizedExpedient(item))
    .map((item) =>
      item.fechaLimite
        ? {
            ...item,
            ...getDeadlineStatus(
              item.fechaLimite,
              configuration.diasFestivos,
              configuration.umbralProximoVencer,
            ),
          }
        : item,
    )
    .sort(
      (first, second) => second.fechaActualizacion.toMillis() - first.fechaActualizacion.toMillis(),
    )
}

export async function listHistoricalExpedients(): Promise<Expedient[]> {
  const snapshot = await getDocs(collection(firestore, EXPEDIENTS_COLLECTION))
  return snapshot.docs
    .map((item) => {
      const data = item.data() as Expedient
      return { ...data, id: item.id }
    })
    .filter(isFinalizedExpedient)
    .sort((a, b) => b.fechaActualizacion.toMillis() - a.fechaActualizacion.toMillis())
}

export async function getExpedient(id: string): Promise<Expedient | null> {
  const snapshot = await getDoc(expedientReference(id))
  if (!snapshot.exists()) return null
  const item = snapshot.data() as Expedient
  const data = { ...item, id: snapshot.id }
  if (!item.fechaLimite) return data
  const configuration = await getBusinessConfiguration()
  return {
    ...data,
    ...getDeadlineStatus(
      item.fechaLimite,
      configuration.diasFestivos,
      configuration.umbralProximoVencer,
    ),
  }
}

export async function createExpedient(
  values: ExpedientFormData,
  createdBy: string,
  assignedOfficial?: AssignedOfficial,
): Promise<string> {
  const reference = doc(collection(firestore, EXPEDIENTS_COLLECTION))
  const expedientData = await toExpedientData(values, assignedOfficial)
  await ensureUniqueFilingNumber(expedientData.numeroRadicado as string)
  const batch = writeBatch(firestore)
  batch.set(reference, {
    ...expedientData,
    // El estado solo avanza desde el flujo del expediente, nunca desde el formulario.
    estado: 'Recibido',
    id: reference.id,
    creadoPor: createdBy,
    activo: true,
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  })
  registerExpedientHistory(batch, reference.id, createdBy, 'Creación del expediente')
  if (assignedOfficial) queueAssignmentEmail(batch, reference.id, assignedOfficial.uid, createdBy)
  await commit(batch)
  return reference.id
}

export async function updateExpedient(
  id: string,
  values: ExpedientFormData,
  userId: string,
  assignedOfficial?: AssignedOfficial,
): Promise<void> {
  const current = await getExpedient(id)
  const data = await toExpedientData(values, assignedOfficial)
  if (current?.numeroRadicado !== data.numeroRadicado) {
    await ensureUniqueFilingNumber(data.numeroRadicado as string, id)
  }
  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    ...data,
    fechaRecibido: values.fechaRecibido ? toTimestamp(values.fechaRecibido) : deleteField(),
    medioIngreso: values.medioIngreso?.trim() || deleteField(),
    funcionarioAsignado: assignedOfficial ?? deleteField(),
    prioridad: values.prioridad ?? deleteField(),
    observacionesIniciales: values.observacionesIniciales?.trim() || deleteField(),
    fechaActualizacion: serverTimestamp(),
  })
  if (current) {
    const changes = [
      current.tipoTramite !== data.tipoTramite &&
        `Tipo de trámite: ${current.tipoTramite ?? 'Sin tipo'} → ${data.tipoTramite}`,
      current.funcionarioAsignado?.uid !== assignedOfficial?.uid &&
        `Responsable: ${current.funcionarioAsignado?.nombreCompleto ?? 'Sin asignar'} → ${assignedOfficial?.nombreCompleto ?? 'Sin asignar'}`,
      current.prioridad !== data.prioridad &&
        `Prioridad: ${current.prioridad ?? 'Sin prioridad'} → ${data.prioridad ?? 'Sin prioridad'}`,
    ].filter(Boolean)
    registerExpedientHistory(
      batch,
      id,
      userId,
      changes.length ? 'Edición del expediente' : 'Actualización del expediente',
      changes.join('. '),
    )
  }
  await commit(batch)
}

export async function archiveExpedient(id: string, userId: string): Promise<void> {
  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    activo: false,
    estado: 'Archivado',
    fechaActualizacion: serverTimestamp(),
  })
  registerExpedientHistory(batch, id, userId, 'Archivo del expediente')
  await commit(batch)
}

/**
 * Asigna un funcionario y, opcionalmente, avanza el flujo en la misma escritura,
 * de modo que asignación, historial y aviso por correo queden o todos o ninguno.
 */
export async function assignExpedient(
  id: string,
  assignee: AssignedOfficial,
  userId: string,
  advanceTo?: ExpedientStatus,
): Promise<void> {
  const current = await getExpedient(id)
  if (!current) throw new Error('Expediente no encontrado.')
  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    funcionarioAsignado: assignee,
    ...(advanceTo ? { estado: advanceTo } : {}),
    fechaActualizacion: serverTimestamp(),
  })
  registerExpedientHistory(
    batch,
    id,
    userId,
    'Cambio de responsable',
    `${current.funcionarioAsignado?.nombreCompleto ?? 'Sin asignar'} → ${assignee.nombreCompleto}`,
  )
  if (advanceTo) {
    registerExpedientHistory(batch, id, userId, 'Asignó responsable', assignee.nombreCompleto)
  }
  queueAssignmentEmail(batch, id, assignee.uid, userId)
  await commit(batch)
}

export async function addExpedientWorkflowDocument(
  expedientId: string,
  document: WorkflowDocumentPayload,
  userId: string,
  userName: string,
): Promise<void> {
  const expedient = await getExpedient(expedientId)
  if (!expedient) throw new Error('No se encontró el expediente relacionado.')
  const documentId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `doc_${Math.random().toString(36).slice(2, 10)}`

  const radicadoFechaTimestamp = document.radicadoFecha
    ? toTimestamp(document.radicadoFecha)
    : undefined

  const workflowDocument: WorkflowDocument = {
    id: documentId,
    nombre: document.nombre,
    tipo: document.tipo,
    url: document.url,
    usuario: userName,
    fecha: Timestamp.fromDate(new Date()),
    ...(document.radicadoNumero ? { radicadoNumero: document.radicadoNumero } : {}),
    ...(radicadoFechaTimestamp ? { radicadoFecha: radicadoFechaTimestamp } : {}),
  }

  const batch = writeBatch(firestore)
  batch.update(expedientReference(expedientId), {
    documentosWorkflow: arrayUnion(workflowDocument),
    fechaActualizacion: serverTimestamp(),
  })
  registerExpedientHistory(
    batch,
    expedientId,
    userId,
    'Documento asociado',
    `${userName} asoció el documento "${workflowDocument.nombre}".`,
  )
  await commit(batch)
}

export async function transferByCompetence(
  id: string,
  destination: string,
  reason: string,
  userId: string,
): Promise<void> {
  const normalizedDestination = destination.trim()
  const normalizedReason = reason.trim()
  if (!normalizedDestination || !normalizedReason) {
    throw new Error('El destino y el motivo del traslado son obligatorios.')
  }
  const current = await getExpedient(id)
  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    trasladoPorCompetencia: true,
    responsableExterno: normalizedDestination,
    estado: 'Traslado por competencia',
    fechaActualizacion: serverTimestamp(),
  })
  registerExpedientHistory(
    batch,
    id,
    userId,
    'Traslado por competencia',
    `${current?.funcionarioAsignado?.nombreCompleto ?? current?.responsableExterno ?? 'Sin asignar'} → ${normalizedDestination}`,
  )
  registerExpedientHistory(batch, id, userId, 'Motivo del traslado', normalizedReason)
  await commit(batch)
}

export async function completeRequiredActuation(
  id: string,
  userId: string,
  action: string,
  detail: string,
  nextStatus: ExpedientStatus,
  fields: ActuationFields = {},
): Promise<void> {
  const current = await getExpedient(id)
  if (!current) throw new Error('Expediente no encontrado.')
  const finalized = nextStatus === 'Archivo (Finalizado)'
  const filingNumber = fields.numeroRadicadoActuacion?.trim()
  if (filingNumber && (await getDoc(getFilingReference(current.id, filingNumber))).exists()) {
    throw new Error(`El radicado ${filingNumber} ya está registrado para este expediente.`)
  }

  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    ...fields,
    estado: nextStatus,
    ...(finalized ? { activo: false } : {}),
    fechaActualizacion: serverTimestamp(),
  })
  registerExpedientHistory(batch, id, userId, action, detail)
  if (filingNumber) {
    const documentType: WorkflowDocument['tipo'] =
      current.estado === 'Generar radicado de traslado' ? 'TRASLADO' : 'RADICADO_SALIDA'
    const supportingDocument = [...(current.documentosWorkflow ?? [])]
      .filter((document) => document.tipo === documentType)
      .sort((first, second) => second.fecha.toMillis() - first.fecha.toMillis())[0]

    registerFiling(batch, {
      numero: filingNumber,
      fecha: fields.fechaRadicadoActuacion ?? toDateKey(new Date()),
      tipo: action.includes('traslado') ? 'Traslado' : 'Salida',
      expedienteId: current.id,
      solicitante: current.solicitantes[0]?.nombre ?? '',
      responsable: current.funcionarioAsignado?.nombreCompleto ?? current.responsableExterno ?? '',
      estado: nextStatus,
      municipio: current.predios[0]?.municipio ?? '',
      observaciones: detail,
      ...(supportingDocument
        ? { documentoUrl: supportingDocument.url, documentoNombre: supportingDocument.nombre }
        : {}),
    })
  }
  if (finalized)
    registerExpedientHistory(
      batch,
      id,
      userId,
      'Finalizó expediente',
      'El expediente fue archivado y enviado al Histórico.',
    )
  await commit(batch)
}

/** Guarda la actuación que produjo planActuation para el paso actual. */
export function applyActuation(
  expedientId: string,
  actuation: Actuation,
  userId: string,
): Promise<void> {
  switch (actuation.kind) {
    case 'assign':
      return assignExpedient(expedientId, actuation.assignee, userId, actuation.advanceTo)
    case 'transfer':
      return transferByCompetence(expedientId, actuation.destination, actuation.reason, userId)
    case 'complete':
      return completeRequiredActuation(
        expedientId,
        userId,
        actuation.action,
        actuation.detail,
        actuation.nextStatus,
        actuation.fields,
      )
  }
}

export async function listExpedientHistory(id: string): Promise<ExpedientHistoryEntry[]> {
  const result = await getDocs(collection(firestore, EXPEDIENTS_COLLECTION, id, 'historial'))
  return result.docs
    .map((item) => ({ id: item.id, ...item.data() }) as ExpedientHistoryEntry)
    .sort((a, b) => (b.fecha?.toMillis() ?? 0) - (a.fecha?.toMillis() ?? 0))
}
