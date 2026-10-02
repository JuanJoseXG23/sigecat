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
import { planExtension, type ExtensionInput } from '@/lib/deadline-extension'
import { getOutgoingFilingNumbers } from '@/lib/entry-filing'
import { toDateKey } from '@/lib/expedient-deadline'
import { parseDocumentLink } from '@/lib/document-links'
import { getFilingCorrectionError, planFilingCorrection } from '@/lib/record-corrections'
import type { Actuation } from '@/lib/expedient-workflow'
import { firestore } from '@/services/firebase'
import { getActiveProcedureType } from '@/services/procedure-type.service'
import { getFilingReference, registerFiling, type FilingRecord } from '@/services/filing.service'
import { queueAssignmentEmail } from '@/services/assignment-email.service'
import type {
  ActuationFields,
  AssignedOfficial,
  DeadlineExtension,
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

function newDocumentId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `doc_${Math.random().toString(36).slice(2, 10)}`
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

/**
 * Datos del formulario listos para Firestore. `extensionDays` son los días ya ampliados, que
 * la fecha límite conserva aunque se edite el expediente.
 */
async function toExpedientData(
  values: ExpedientFormData,
  assignedOfficial?: AssignedOfficial,
  extensionDays = 0,
): Promise<Record<string, unknown>> {
  const [procedureType, configuration] = await Promise.all([
    getActiveProcedureType(values.tipoTramiteId),
    getBusinessConfiguration(),
  ])
  if (!procedureType) throw new Error('Debes seleccionar un tipo de trámite activo.')
  const responseDays = procedureType.diasRespuesta
  const fechaLimite = calculateDeadline(
    values.fechaRadicado,
    responseDays + extensionDays,
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
    asunto: values.asunto?.trim(),
    diasTermino: responseDays,
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

async function withDeadlineStatus(items: Expedient[]): Promise<Expedient[]> {
  const configuration = await getBusinessConfiguration()
  return items.map((item) =>
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
}

function byLastUpdate(first: Expedient, second: Expedient): number {
  return second.fechaActualizacion.toMillis() - first.fechaActualizacion.toMillis()
}

/**
 * Expedientes activos. Con assigneeUid solo trae los de ese responsable, filtrando en
 * Firestore para no descargar los de todo el equipo.
 */
export async function listExpedients(assigneeUid?: string): Promise<Expedient[]> {
  const constraints = [where('activo', '==', true)]
  if (assigneeUid) constraints.push(where('funcionarioAsignado.uid', '==', assigneeUid))
  const snapshot = await getDocs(
    query(collection(firestore, EXPEDIENTS_COLLECTION), ...constraints),
  )
  const items = snapshot.docs
    .map((item) => ({ ...(item.data() as Expedient), id: item.id }))
    .filter((item) => !isFinalizedExpedient(item))
  return (await withDeadlineStatus(items)).sort(byLastUpdate)
}

/** Al finalizar o archivar, `activo` pasa a false; por eso basta con ese filtro. */
export async function listHistoricalExpedients(): Promise<Expedient[]> {
  const snapshot = await getDocs(
    query(collection(firestore, EXPEDIENTS_COLLECTION), where('activo', '==', false)),
  )
  return snapshot.docs
    .map((item) => ({ ...(item.data() as Expedient), id: item.id }))
    .sort(byLastUpdate)
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
  const data = await toExpedientData(values, assignedOfficial, current?.diasAmpliacion ?? 0)
  if (current && current.numeroRadicado !== data.numeroRadicado) {
    if (getOutgoingFilingNumbers(current).has(data.numeroRadicado as string))
      throw new Error(
        `${data.numeroRadicado} es un radicado de respuesta, traslado o ampliación de este expediente; el radicado de entrada no se reemplaza.`,
      )
    await ensureUniqueFilingNumber(data.numeroRadicado as string, id)
  }
  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    ...data,
    fechaRecibido: values.fechaRecibido ? toTimestamp(values.fechaRecibido) : deleteField(),
    medioIngreso: values.medioIngreso?.trim() || deleteField(),
    asunto: values.asunto?.trim() || deleteField(),
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

export async function archiveExpedient(id: string, userId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error('Indica el motivo del archivo.')
  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    activo: false,
    estado: 'Archivado',
    fechaCierre: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  })
  registerExpedientHistory(batch, id, userId, 'Archivo del expediente', reason.trim())
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
  const documentId = newDocumentId()

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
    ...(document.folios ? { folios: document.folios } : {}),
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
    ...(finalized ? { activo: false, fechaCierre: serverTimestamp() } : {}),
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
      expedienteRadicado: current.numeroRadicado,
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

/**
 * Amplía el término de respuesta. En un mismo lote guarda la nueva fecha límite, el detalle
 * de la ampliación, el radicado escaneado como documento del expediente, el radicado en el
 * libro de radicación y el historial.
 */
export async function extendExpedientDeadline(
  id: string,
  input: ExtensionInput,
  userId: string,
  userName: string,
): Promise<Date> {
  const [current, configuration] = await Promise.all([getExpedient(id), getBusinessConfiguration()])
  if (!current) throw new Error('Expediente no encontrado.')
  if (isFinalizedExpedient(current)) throw new Error('El expediente ya está cerrado.')
  if (!current.fechaLimite) throw new Error('El expediente no tiene fecha límite calculada.')
  const responseDays =
    current.diasTermino ?? (await getActiveProcedureType(current.tipoTramiteId))?.diasRespuesta
  if (!responseDays) throw new Error('No se conoce el término inicial del tipo de trámite.')

  const plan = planExtension(input, {
    entryDate: toDateKey(current.fechaRadicado.toDate()),
    currentDeadline: current.fechaLimite.toDate(),
    responseDays,
    previousExtensionDays: current.diasAmpliacion ?? 0,
    holidays: configuration.diasFestivos,
  })
  const filingNumber = input.filingNumber.trim()
  if ((await getDoc(getFilingReference(current.id, filingNumber))).exists()) {
    throw new Error(`El radicado ${filingNumber} ya está registrado para este expediente.`)
  }

  const now = Timestamp.now()
  const newDeadline = Timestamp.fromDate(plan.newDeadline)
  const reason = input.reason.trim()
  const documentName = input.documentName.trim()
  const documentUrl = input.documentUrl.trim()
  const extension: DeadlineExtension = {
    numeroRadicado: filingNumber,
    fechaRadicado: input.filingDate,
    diasSolicitados: input.requestedDays,
    motivo: reason,
    documentoNombre: documentName,
    documentoUrl: documentUrl,
    fechaLimiteAnterior: current.fechaLimite,
    fechaLimiteNueva: newDeadline,
    usuario: userName,
    fecha: now,
  }
  const supportingDocument: WorkflowDocument = {
    id: newDocumentId(),
    tipo: 'AMPLIACION_PLAZO',
    nombre: documentName,
    url: documentUrl,
    usuario: userName,
    fecha: now,
    radicadoNumero: filingNumber,
    radicadoFecha: toTimestamp(input.filingDate)!,
  }
  const formattedDeadline = plan.newDeadline.toLocaleDateString('es-CO')

  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    fechaLimite: newDeadline,
    diasTermino: responseDays,
    diasAmpliacion: plan.totalExtensionDays,
    ampliacionesPlazo: arrayUnion(extension),
    documentosWorkflow: arrayUnion(supportingDocument),
    fechaActualizacion: serverTimestamp(),
  })
  registerExpedientHistory(
    batch,
    id,
    userId,
    'Amplió el plazo de respuesta',
    `${input.requestedDays} días hábiles con el radicado ${filingNumber}. Nueva fecha límite: ${formattedDeadline}. Motivo: ${reason}`,
  )
  registerFiling(batch, {
    numero: filingNumber,
    fecha: input.filingDate,
    tipo: 'Ampliación de plazo',
    expedienteId: current.id,
    expedienteRadicado: current.numeroRadicado,
    solicitante: current.solicitantes[0]?.nombre ?? '',
    responsable: current.funcionarioAsignado?.nombreCompleto ?? current.responsableExterno ?? '',
    estado: current.estado,
    municipio: current.predios[0]?.municipio ?? '',
    observaciones: reason,
    documentoUrl: documentUrl,
    documentoNombre: documentName,
  })
  await commit(batch)
  return plan.newDeadline
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

/**
 * Corrige número o fecha de un radicado ya registrado (solo supervisores). El id del radicado
 * incluye el número, así que un número nuevo crea otro documento y borra el anterior. En el
 * mismo lote se actualiza cada lugar del expediente que lo menciona y se deja el historial.
 */
export async function correctFiling(
  filing: FilingRecord,
  values: { number: string; date: string },
  userId: string,
): Promise<void> {
  const number = values.number.trim()
  const correction = { previousNumber: filing.numero, number, date: values.date }
  const error = getFilingCorrectionError(correction, filing.fecha, toDateKey(new Date()))
  if (error) throw new Error(error)

  const previousReference = doc(firestore, 'radicados', filing.id)
  const [previous, expedient] = await Promise.all([
    getDoc(previousReference),
    getExpedient(filing.expedienteId),
  ])
  if (!previous.exists()) throw new Error('El radicado ya no existe.')

  const batch = writeBatch(firestore)
  const audit = { editadoPor: userId, fechaEdicion: serverTimestamp() }
  if (number !== filing.numero) {
    const reference = getFilingReference(filing.expedienteId, number)
    if ((await getDoc(reference)).exists())
      throw new Error(`El radicado ${number} ya está registrado para este expediente.`)
    batch.set(reference, {
      ...previous.data(),
      numero: number,
      fecha: values.date,
      id: reference.id,
      ...audit,
    })
    batch.delete(previousReference)
  } else {
    batch.update(previousReference, { fecha: values.date, ...audit })
  }

  if (expedient) {
    const changes = planFilingCorrection(expedient, correction, (date) => toTimestamp(date)!)
    if (Object.keys(changes).length)
      batch.update(expedientReference(expedient.id), {
        ...changes,
        fechaActualizacion: serverTimestamp(),
      })
    registerExpedientHistory(
      batch,
      expedient.id,
      userId,
      'Corrigió radicado',
      `${filing.tipo}: ${filing.numero} del ${filing.fecha} → ${number} del ${values.date}.`,
    )
  }
  await commit(batch)
}

/** Corrige nombre, enlace o folios de un documento asociado (solo supervisores). */
export async function correctWorkflowDocument(
  expedientId: string,
  documentId: string,
  values: { name: string; url: string; folios: string },
  userId: string,
): Promise<void> {
  const parsed = parseDocumentLink(values.name, values.url, values.folios)
  if ('error' in parsed) throw new Error(parsed.error)
  const expedient = await getExpedient(expedientId)
  const current = expedient?.documentosWorkflow?.find((document) => document.id === documentId)
  if (!expedient || !current) throw new Error('No se encontró el documento.')

  // Firestore no acepta undefined: sin folios, el campo se omite.
  const updated: WorkflowDocument = { ...current, ...parsed.document }
  if (!parsed.document.folios) delete updated.folios
  const batch = writeBatch(firestore)
  batch.update(expedientReference(expedientId), {
    documentosWorkflow: (expedient.documentosWorkflow ?? []).map((document) =>
      document.id === documentId ? updated : document,
    ),
    fechaActualizacion: serverTimestamp(),
  })
  const changes = [
    current.nombre !== updated.nombre && `Nombre: ${current.nombre} → ${updated.nombre}`,
    current.url !== updated.url && 'Enlace actualizado',
    current.folios !== updated.folios &&
      `Folios: ${current.folios ?? '—'} → ${updated.folios ?? '—'}`,
  ].filter(Boolean)
  if (!changes.length) throw new Error('No hay cambios para guardar.')
  registerExpedientHistory(batch, expedientId, userId, 'Corrigió documento', changes.join('. '))
  await commit(batch)
}
