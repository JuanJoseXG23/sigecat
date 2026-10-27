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
  orderBy,
  limit,
  arrayUnion,
  writeBatch,
  type QuerySnapshot,
  type WriteBatch,
} from 'firebase/firestore'
import {
  calculateDeadline,
  getBusinessConfiguration,
  getDeadlineStatus,
  registerExpedientHistory,
} from '@/services/business-rules.service'
import { planExtension, type ExtensionInput } from '@/lib/deadline-extension'
import { isDeadlineOf } from '@/lib/calendar'
import { getCorrespondenceClass } from '@/lib/correspondence'
import { getDependencyName, getExpedientDependency, toDependencyId } from '@/lib/dependencies'
import { getYearBounds } from '@/lib/periods'
import {
  describeResponseSupport,
  getResponseSupportError,
  type ResponseSupportInput,
} from '@/lib/response-support'
import { getOutgoingFilingNumbers } from '@/lib/entry-filing'
import { normalizeIntakeChannel } from '@/lib/intake-channels'
import { describeExpedientChanges } from '@/lib/expedient-changes'
import { getNoteError, NOTE_ACTION } from '@/lib/expedient-notes'
import { sortHistoryNewestFirst } from '@/lib/history-order'
import { fromDateKey, toDateKey } from '@/lib/expedient-deadline'
import { parseDocumentLink } from '@/lib/document-links'
import { getFilingCorrectionError, planFilingCorrection } from '@/lib/record-corrections'
import {
  planLateRegistration,
  type ExistingDocument,
  type LateRegistrationInput,
  type LateRegistrationPlan,
} from '@/lib/late-registration'
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
  LateRegistrationRecord,
  ResponseSupport,
  WorkflowDocument,
  WorkflowDocumentPayload,
  WorkflowDocumentType,
} from '@/types/expedient'
import { isFinalizedExpedient } from '@/types/expedient'

const EXPEDIENTS_COLLECTION = 'expedientes'
const ENTRY_FILINGS_COLLECTION = 'radicadosEntrada'

/**
 * Suma a `participantes` a quien actúa y, si cambia, al nuevo responsable. Va en cada escritura
 * del expediente; la lista nunca se recorta.
 */
function withParticipants(...uids: (string | undefined)[]) {
  return { participantes: arrayUnion(...uids.filter((uid): uid is string => Boolean(uid))) }
}

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

/**
 * Índice que hace único el radicado de entrada: un Funcionario no puede consultar los
 * expedientes ajenos, así que la unicidad la garantizan las reglas al reservar el número en
 * el mismo lote que el expediente.
 */
function entryFilingReference(number: string) {
  return doc(firestore, ENTRY_FILINGS_COLLECTION, number)
}

async function ensureUniqueFilingNumber(number: string, currentId?: string): Promise<void> {
  if (number.includes('/')) throw new Error('El radicado de entrada no puede contener "/".')
  const snapshot = await getDoc(entryFilingReference(number))
  if (snapshot.exists() && snapshot.data().expedienteId !== currentId) {
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
    dependencia: values.dependencia,
    clase: values.clase,
    numeroRadicado: values.numeroRadicado.trim(),
    fechaRadicado: toTimestamp(values.fechaRadicado),
    fechaRecibido: toTimestamp(values.fechaRecibido),
    medioIngreso: normalizeIntakeChannel(values.medioIngreso),
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
 * Con `participant` solo pide los expedientes donde figura esa persona: es lo único que las
 * reglas le dejan consultar a un Funcionario (ver getParticipantScope).
 */
function scopeTo(participant: string | undefined) {
  return participant ? [where('participantes', 'array-contains', participant)] : []
}

/** Expedientes activos; con `participant`, solo aquellos donde figura. */
export async function listExpedients(participant?: string): Promise<Expedient[]> {
  const constraints = [where('activo', '==', true), ...scopeTo(participant)]
  const snapshot = await getDocs(
    query(collection(firestore, EXPEDIENTS_COLLECTION), ...constraints),
  )
  const items = snapshot.docs
    .map((item) => ({ ...(item.data() as Expedient), id: item.id }))
    .filter((item) => !isFinalizedExpedient(item))
  return (await withDeadlineStatus(items)).sort(byLastUpdate)
}

function toExpedients(snapshot: QuerySnapshot): Expedient[] {
  return snapshot.docs.map((item) => ({ ...(item.data() as Expedient), id: item.id }))
}

/** Rango [inicio, fin) del año sobre un campo de fecha; sin año, todo el archivo. */
function inYear(field: string, year: number | undefined) {
  if (year === undefined) return []
  const [start, end] = getYearBounds(year)
  return [where(field, '>=', Timestamp.fromDate(start)), where(field, '<', Timestamp.fromDate(end))]
}

/** Año del primer valor de `field`, con una sola lectura; undefined si no hay ninguno. */
export async function getFirstYear(
  field: 'fechaRadicado' | 'fechaCierre',
): Promise<number | undefined> {
  const snapshot = await getDocs(
    query(collection(firestore, EXPEDIENTS_COLLECTION), orderBy(field), limit(1)),
  )
  const value = snapshot.docs[0]?.get(field) as Timestamp | undefined
  return value?.toDate().getFullYear()
}

/**
 * Cerrados en el año (por `fechaCierre`, que la migración completó en los antiguos); sin año,
 * todos. Para quien ve todo: el Funcionario usa listHistoricalExpedients(uid).
 */
export async function listClosedExpedientsInYear(year: number | undefined): Promise<Expedient[]> {
  const snapshot = await getDocs(
    year === undefined
      ? query(collection(firestore, EXPEDIENTS_COLLECTION), where('activo', '==', false))
      : query(collection(firestore, EXPEDIENTS_COLLECTION), ...inYear('fechaCierre', year)),
  )
  return toExpedients(snapshot)
    .filter((item) => !item.activo)
    .sort(byLastUpdate)
}

/**
 * Expedientes radicados en el año, activos y cerrados (para Reportes y la Biblioteca); sin año,
 * todos. El término de los activos se recalcula como en listExpedients.
 */
export async function listExpedientsFiledInYear(year: number | undefined): Promise<Expedient[]> {
  const snapshot = await getDocs(
    query(collection(firestore, EXPEDIENTS_COLLECTION), ...inYear('fechaRadicado', year)),
  )
  const items = toExpedients(snapshot)
  const active = await withDeadlineStatus(items.filter((item) => !isFinalizedExpedient(item)))
  return [...active, ...items.filter(isFinalizedExpedient)].sort(byLastUpdate)
}

/** Al finalizar o archivar, `activo` pasa a false; por eso basta con ese filtro. */
export async function listHistoricalExpedients(participant?: string): Promise<Expedient[]> {
  const snapshot = await getDocs(
    query(
      collection(firestore, EXPEDIENTS_COLLECTION),
      where('activo', '==', false),
      ...scopeTo(participant),
    ),
  )
  return snapshot.docs
    .map((item) => ({ ...(item.data() as Expedient), id: item.id }))
    .sort(byLastUpdate)
}

/**
 * Cerrados con cambios desde `since`. Un expediente cerrado desde esa fecha se actualizó por
 * última vez después de ella, así que basta con ese rango para no descargar todo el archivo.
 * `activo` se filtra aquí: combinarlo con el rango en Firestore exigiría un índice compuesto.
 */
export async function listClosedExpedientsSince(since: Date): Promise<Expedient[]> {
  const snapshot = await getDocs(
    query(
      collection(firestore, EXPEDIENTS_COLLECTION),
      where('fechaActualizacion', '>=', Timestamp.fromDate(since)),
    ),
  )
  return snapshot.docs
    .map((item) => ({ ...(item.data() as Expedient), id: item.id }))
    .filter((item) => !item.activo)
    .sort(byLastUpdate)
}

/**
 * Vencimientos de una persona entre dos fechas (el final excluido), para su calendario: lo que
 * tiene asignado en trámite y lo que respondió. Se pide por `participantes`, que es lo que las
 * reglas le permiten consultar a un Funcionario sobre sí mismo.
 */
export async function listDeadlinesInRange(uid: string, start: Date, end: Date) {
  const snapshot = await getDocs(
    query(
      collection(firestore, EXPEDIENTS_COLLECTION),
      where('participantes', 'array-contains', uid),
      where('fechaLimite', '>=', Timestamp.fromDate(start)),
      where('fechaLimite', '<', Timestamp.fromDate(end)),
    ),
  )
  const items = toExpedients(snapshot).filter((item) => isDeadlineOf(item, uid))
  const active = await withDeadlineStatus(items.filter((item) => !isFinalizedExpedient(item)))
  return [...active, ...items.filter(isFinalizedExpedient)]
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
    participantes: [...new Set([createdBy, assignedOfficial?.uid].filter(Boolean))],
    activo: true,
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  })
  batch.set(entryFilingReference(expedientData.numeroRadicado as string), {
    expedienteId: reference.id,
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
    medioIngreso: normalizeIntakeChannel(values.medioIngreso) ?? deleteField(),
    asunto: values.asunto?.trim() || deleteField(),
    funcionarioAsignado: assignedOfficial ?? deleteField(),
    prioridad: values.prioridad ?? deleteField(),
    observacionesIniciales: values.observacionesIniciales?.trim() || deleteField(),
    fechaActualizacion: serverTimestamp(),
    ...withParticipants(userId, assignedOfficial?.uid),
  })
  if (current && current.numeroRadicado !== data.numeroRadicado) {
    batch.set(entryFilingReference(data.numeroRadicado as string), { expedienteId: id })
    batch.delete(entryFilingReference(current.numeroRadicado))
    // El libro de Radicación muestra el radicado de entrada de cada expediente: se actualiza.
    const filings = await getDocs(
      query(collection(firestore, 'radicados'), where('expedienteId', '==', id)),
    )
    for (const filing of filings.docs)
      batch.update(filing.ref, { expedienteRadicado: data.numeroRadicado })
  }
  if (current) {
    const changes = describeExpedientChanges(
      {
        area: getDependencyName(getExpedientDependency(current)),
        correspondencia: getCorrespondenceClass(current),
        numeroRadicado: current.numeroRadicado,
        fechaRadicado: toDateKey(current.fechaRadicado.toDate()),
        fechaRecibido: current.fechaRecibido && toDateKey(current.fechaRecibido.toDate()),
        medioIngreso: current.medioIngreso,
        tipoTramite: current.tipoTramite,
        asunto: current.asunto,
        responsable: current.funcionarioAsignado?.nombreCompleto,
        prioridad: current.prioridad,
        solicitantes: current.solicitantes,
        predios: current.predios ?? [],
        observaciones: current.observacionesIniciales,
      },
      {
        area: getDependencyName(values.dependencia),
        correspondencia: values.clase,
        numeroRadicado: data.numeroRadicado as string,
        fechaRadicado: values.fechaRadicado,
        fechaRecibido: values.fechaRecibido,
        medioIngreso: values.medioIngreso,
        tipoTramite: data.tipoTramite as string | undefined,
        asunto: values.asunto,
        responsable: assignedOfficial?.nombreCompleto,
        prioridad: values.prioridad,
        solicitantes: values.solicitantes,
        predios: values.predios,
        observaciones: values.observacionesIniciales,
      },
    )
    // Guardar sin cambios solo llenaría el historial de entradas vacías.
    if (!changes.length) throw new Error('No hay cambios para guardar.')
    registerExpedientHistory(batch, id, userId, 'Edición del expediente', changes.join('. '))
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
    ...withParticipants(userId),
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
    ...withParticipants(userId, assignee.uid),
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
    ...withParticipants(userId),
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
    ...withParticipants(userId),
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
  respondedBy?: AssignedOfficial,
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
    ...(respondedBy ? { funcionarioAsignado: respondedBy } : {}),
    ...(finalized ? { activo: false, fechaCierre: serverTimestamp() } : {}),
    fechaActualizacion: serverTimestamp(),
    ...withParticipants(userId, respondedBy?.uid),
  })
  if (respondedBy) {
    registerExpedientHistory(
      batch,
      id,
      userId,
      'Cambio de responsable',
      `${current.funcionarioAsignado?.nombreCompleto ?? 'Sin asignar'} → ${respondedBy.nombreCompleto}. Proyectó y firmó la actuación.`,
    )
    if (!finalized) queueAssignmentEmail(batch, id, respondedBy.uid, userId)
  }
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
      ...(fields.fechaEnvioActuacion ? { fechaEnvio: fields.fechaEnvioActuacion } : {}),
      tipo: action.includes('traslado') ? 'Traslado' : 'Salida',
      expedienteId: current.id,
      expedienteRadicado: current.numeroRadicado,
      solicitante: current.solicitantes[0]?.nombre ?? '',
      responsable:
        (respondedBy ?? current.funcionarioAsignado)?.nombreCompleto ??
        current.responsableExterno ??
        '',
      estado: nextStatus,
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
    correspondenceClass: getCorrespondenceClass(current),
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
    ...withParticipants(userId),
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
    observaciones: reason,
    documentoUrl: documentUrl,
    documentoNombre: documentName,
  })
  await commit(batch)
  return plan.newDeadline
}

/** Documento más reciente de cada tipo, para no pedir de nuevo lo que ya está asociado. */
export function getLatestDocuments(
  expedient: Pick<Expedient, 'documentosWorkflow'>,
): Partial<Record<WorkflowDocumentType, ExistingDocument>> {
  const latest: Partial<Record<WorkflowDocumentType, ExistingDocument>> = {}
  const documents = [...(expedient.documentosWorkflow ?? [])].sort(
    (first, second) => first.fecha.toMillis() - second.fecha.toMillis(),
  )
  for (const document of documents)
    latest[document.tipo] = { nombre: document.nombre, url: document.url }
  return latest
}

/**
 * Registro tardío: guarda en un solo lote, con sus fechas reales, las actuaciones que se
 * hicieron a tiempo pero no se subieron (recepción, responsable, ampliación, traslado y
 * respuesta). Si algo falla no queda nada a medias. Devuelve el plan para informar el
 * resultado frente al término.
 */
export async function registerLateActuations(
  id: string,
  input: LateRegistrationInput,
  userId: string,
  userName: string,
): Promise<LateRegistrationPlan> {
  const [current, configuration] = await Promise.all([getExpedient(id), getBusinessConfiguration()])
  if (!current) throw new Error('Expediente no encontrado.')
  if (isFinalizedExpedient(current)) throw new Error('El expediente ya está cerrado.')
  if (!current.fechaLimite) throw new Error('El expediente no tiene fecha límite calculada.')
  const responseDays =
    current.diasTermino ?? (await getActiveProcedureType(current.tipoTramiteId))?.diasRespuesta
  if (!responseDays) throw new Error('No se conoce el término inicial del tipo de trámite.')

  const plan = planLateRegistration(input, {
    status: current.estado,
    entryNumber: current.numeroRadicado,
    entryDate: toDateKey(current.fechaRadicado.toDate()),
    currentDeadline: current.fechaLimite.toDate(),
    responseDays,
    previousExtensionDays: current.diasAmpliacion ?? 0,
    currentAssignee: current.funcionarioAsignado,
    existingDocuments: getLatestDocuments(current),
    holidays: configuration.diasFestivos,
    correspondenceClass: getCorrespondenceClass(current),
  })
  const existing = await Promise.all(
    plan.filings.map((filing) => getDoc(getFilingReference(current.id, filing.numero))),
  )
  const repeated = plan.filings.find((_, index) => existing[index].exists())
  if (repeated)
    throw new Error(`El radicado ${repeated.numero} ya está registrado para este expediente.`)

  const now = Timestamp.now()
  const assignee = plan.assignee ?? current.funcionarioAsignado
  const responsible = assignee?.nombreCompleto ?? current.responsableExterno ?? ''
  const documents: WorkflowDocument[] = plan.documents.map((document) => ({
    id: newDocumentId(),
    tipo: document.tipo,
    nombre: document.nombre,
    url: document.url,
    usuario: userName,
    fecha: now,
    ...(document.folios ? { folios: document.folios } : {}),
    ...(document.radicadoNumero ? { radicadoNumero: document.radicadoNumero } : {}),
    ...(document.radicadoFecha ? { radicadoFecha: toTimestamp(document.radicadoFecha)! } : {}),
  }))
  const record: LateRegistrationRecord = {
    motivo: input.reason.trim(),
    usuario: userName,
    fecha: now,
  }
  const extension = plan.extension && {
    numeroRadicado: input.extension.filingNumber.trim(),
    fechaRadicado: input.extension.filingDate,
    diasSolicitados: input.extension.requestedDays,
    motivo: input.extension.reason.trim(),
    documentoNombre: input.extension.documentName.trim(),
    documentoUrl: input.extension.documentUrl.trim(),
    fechaLimiteAnterior: current.fechaLimite,
    fechaLimiteNueva: Timestamp.fromDate(plan.extension.newDeadline),
    usuario: userName,
    fecha: now,
  }

  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    ...plan.fields,
    estado: plan.finalStatus,
    ...(plan.assignee ? { funcionarioAsignado: plan.assignee } : {}),
    ...(documents.length ? { documentosWorkflow: arrayUnion(...documents) } : {}),
    ...(extension
      ? {
          fechaLimite: extension.fechaLimiteNueva,
          diasTermino: responseDays,
          diasAmpliacion: plan.extension!.totalExtensionDays,
          ampliacionesPlazo: arrayUnion(extension),
        }
      : {}),
    ...(plan.finalized
      ? { activo: false, fechaCierre: Timestamp.fromDate(fromDateKey(plan.closingDate!)) }
      : {}),
    registrosTardios: arrayUnion(record),
    fechaActualizacion: serverTimestamp(),
    ...withParticipants(userId, plan.assignee?.uid),
  })
  for (const entry of plan.history)
    registerExpedientHistory(batch, id, userId, entry.action, entry.detail)
  for (const filing of plan.filings)
    registerFiling(batch, {
      numero: filing.numero,
      fecha: filing.fecha,
      ...(filing.fechaEnvio ? { fechaEnvio: filing.fechaEnvio } : {}),
      tipo: filing.tipo,
      expedienteId: current.id,
      expedienteRadicado: current.numeroRadicado,
      solicitante: current.solicitantes[0]?.nombre ?? '',
      responsable: responsible,
      estado: plan.finalStatus,
      observaciones: `Registro tardío. ${record.motivo}`,
      registroTardio: true,
      ...(filing.documento
        ? { documentoUrl: filing.documento.url, documentoNombre: filing.documento.nombre }
        : {}),
    })
  // Un expediente cerrado no necesita aviso de asignación.
  if (plan.assignee && !plan.finalized) queueAssignmentEmail(batch, id, plan.assignee.uid, userId)
  await commit(batch)
  return plan
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
        actuation.respondedBy,
      )
  }
}

/** Deja constancia del apoyo de otra área en la respuesta, con su historial. */
export async function addResponseSupport(
  id: string,
  input: ResponseSupportInput,
  userId: string,
): Promise<void> {
  const error = getResponseSupportError(input)
  if (error) throw new Error(error)
  const support: ResponseSupport = {
    dependencia: toDependencyId(input.dependencia)!,
    persona: input.persona.trim(),
    ...(input.personaUid ? { personaUid: input.personaUid } : {}),
    descripcion: input.descripcion.trim(),
    usuario: userId,
    fecha: Timestamp.now(),
  }
  const batch = writeBatch(firestore)
  batch.update(expedientReference(id), {
    apoyosRespuesta: arrayUnion(support),
    fechaActualizacion: serverTimestamp(),
    ...withParticipants(userId, input.personaUid),
  })
  registerExpedientHistory(batch, id, userId, 'Apoyo en respuesta', describeResponseSupport(input))
  await commit(batch)
}

/**
 * Agrega una nota al historial. No toca el expediente: así la puede dejar también quien ya no
 * lo gestiona (las reglas solo admiten esa forma exacta, ver `isValidNote`).
 */
export async function addExpedientNote(id: string, text: string, userId: string): Promise<void> {
  const error = getNoteError(text)
  if (error) throw new Error(error)
  const batch = writeBatch(firestore)
  registerExpedientHistory(batch, id, userId, NOTE_ACTION, text.trim())
  await commit(batch)
}

export async function listExpedientHistory(id: string): Promise<ExpedientHistoryEntry[]> {
  const result = await getDocs(collection(firestore, EXPEDIENTS_COLLECTION, id, 'historial'))
  return sortHistoryNewestFirst(
    result.docs.map((item) => ({ id: item.id, ...item.data() }) as ExpedientHistoryEntry),
  )
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
  const previousReference = doc(firestore, 'radicados', filing.id)
  const [previous, expedient] = await Promise.all([
    getDoc(previousReference),
    getExpedient(filing.expedienteId),
  ])
  // El formato aceptado depende de la clase del expediente: se lee antes de validar.
  const error = getFilingCorrectionError(
    correction,
    filing.fecha,
    toDateKey(new Date()),
    expedient ? getCorrespondenceClass(expedient) : 'Externa',
  )
  if (error) throw new Error(error)
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
        ...withParticipants(userId),
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
    ...withParticipants(userId),
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
