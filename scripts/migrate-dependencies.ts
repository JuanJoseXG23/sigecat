import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type UpdateData,
} from 'firebase-admin/firestore'
import { DEFAULT_DEPENDENCY, toDependencyId } from '../src/lib/dependencies.js'
import {
  deriveParticipants,
  findNamedPeople,
  type HistoryLike,
  type PersonLike,
} from '../src/lib/participants.js'

/**
 * Prepara los datos existentes para la separación por áreas (docs/diseno-dependencias-y-permisos.md):
 *
 * - radicadosEntrada/{número}: índice que hace único el radicado de entrada.
 * - expedientes: `dependencia` = catastro si no la tienen; `participantes` reconstruidos desde
 *   el creador, el responsable y el historial; `fechaCierre` = `fechaActualizacion` en los
 *   cerrados que no la tienen.
 * - radicados: `dependencia` y `participantes` de su expediente.
 * - usuarios: `dependencia` escrita a mano ("Catastro") → id del catálogo.
 *
 * Solo agrega o completa campos: no borra ni cambia nada más, ni la fecha de actualización.
 * Sin --apply solo muestra lo que haría. Con --apply guarda antes en backups/ los valores
 * anteriores de cada campo que toca; --restore=<archivo> los devuelve.
 *
 * Lee cada expediente con su historial: cuenta para la cuota diaria de lecturas de Firestore.
 *
 * npx tsx scripts/migrate-dependencies.ts [--apply | --restore=backups/archivo.json]
 */
const apply = process.argv.includes('--apply')
const restoreFile = process.argv.find((arg) => arg.startsWith('--restore='))?.slice(10)
const serviceAccountPath = path.resolve(
  process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH?.trim().replace(/^["']|["']$/g, '') ||
    'secrets/firebase-admin.json',
)
const app =
  getApps()[0] ??
  initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const firestore = getFirestore(app)

/**
 * Valor anterior de cada campo tocado; null significa que el campo no existía. `created`
 * marca los documentos nuevos (el índice de radicados de entrada), que se borran al restaurar.
 */
interface BackupEntry {
  path: string
  previous: Record<string, unknown>
  created?: boolean
}

interface Change {
  ref: DocumentReference
  fields: Record<string, unknown>
  previous: Record<string, unknown>
  create?: boolean
}

interface Operation {
  ref: DocumentReference
  mode: 'update' | 'create' | 'delete'
  data?: Record<string, unknown>
}

async function commitInChunks(operations: Operation[]) {
  for (let index = 0; index < operations.length; index += 400) {
    const batch = firestore.batch()
    for (const operation of operations.slice(index, index + 400)) {
      // Los valores vienen del propio Firestore o de la copia; se escriben tal cual.
      const data = operation.data as UpdateData<DocumentData>
      if (operation.mode === 'delete') batch.delete(operation.ref)
      // create falla si el documento ya existe: nunca pisa un índice.
      else if (operation.mode === 'create') batch.create(operation.ref, data as DocumentData)
      else batch.update(operation.ref, data)
    }
    await batch.commit()
  }
}

if (restoreFile) {
  const entries = JSON.parse(readFileSync(restoreFile, 'utf8')) as BackupEntry[]
  await commitInChunks(
    entries.map((entry): Operation => {
      const ref = firestore.doc(entry.path)
      if (entry.created) return { ref, mode: 'delete' }
      const data = Object.fromEntries(
        Object.entries(entry.previous).map(([field, value]) => [
          field,
          value === null ? FieldValue.delete() : value,
        ]),
      )
      return { ref, mode: 'update', data }
    }),
  )
  console.log(`Restaurados ${entries.length} documento(s) desde ${restoreFile}.`)
  process.exit(0)
}

/** Responsables nombrados en asignaciones ("A → B") que no corresponden a ningún usuario. */
function unmatchedAssignees(history: HistoryLike[]): string[] {
  return history
    .filter((entry) => ['Asignó responsable', 'Cambio de responsable'].includes(entry.accion))
    .flatMap((entry) => entry.detalle.split('.')[0].split('→'))
    .map((name) => name.trim())
    .filter((name) => name && name !== 'Sin asignar' && !findNamedPeople(name, people).length)
}

let reads = 0
const [users, expedients, filings, entryFilings] = await Promise.all([
  firestore.collection('usuarios').get(),
  firestore.collection('expedientes').get(),
  firestore.collection('radicados').get(),
  firestore.collection('radicadosEntrada').get(),
])
reads += users.size + expedients.size + filings.size + entryFilings.size

const people: PersonLike[] = users.docs.map((item) => ({
  uid: item.id,
  nombreCompleto: String(item.data().nombreCompleto ?? ''),
}))
const changes: Change[] = []
const review: string[] = []
const participantsByExpedient = new Map<string, string[]>()
const dependencyByExpedient = new Map<string, string>()

for (const snapshot of users.docs) {
  const value = snapshot.data().dependencia as string | undefined
  if (!value) continue
  const id = toDependencyId(value)
  if (!id)
    review.push(
      `USUARIO  ${snapshot.data().nombreCompleto}: área "${value}" no corresponde a ninguna; elígela en Usuarios.`,
    )
  else if (id !== value)
    changes.push({
      ref: snapshot.ref,
      fields: { dependencia: id },
      previous: { dependencia: value },
    })
}

for (const snapshot of expedients.docs) {
  const data = snapshot.data()
  const history = await snapshot.ref.collection('historial').get()
  reads += history.size || 1
  const participants = deriveParticipants(
    {
      creadoPor: data.creadoPor,
      funcionarioAsignado: data.funcionarioAsignado,
      participantes: data.participantes,
      history: history.docs.map((entry) => entry.data() as HistoryLike),
    },
    people,
  )
  const dependency = toDependencyId(data.dependencia) ?? DEFAULT_DEPENDENCY
  participantsByExpedient.set(snapshot.id, participants)
  dependencyByExpedient.set(snapshot.id, dependency)

  const fields: Record<string, unknown> = {}
  const previous: Record<string, unknown> = {}
  if (data.dependencia !== dependency) {
    fields.dependencia = dependency
    previous.dependencia = data.dependencia ?? null
  }
  const current: string[] = data.participantes ?? []
  if (participants.length !== current.length) {
    fields.participantes = participants
    previous.participantes = data.participantes ?? null
  }
  if (data.activo === false && !data.fechaCierre && data.fechaActualizacion) {
    fields.fechaCierre = data.fechaActualizacion
    previous.fechaCierre = null
  }
  for (const name of unmatchedAssignees(history.docs.map((entry) => entry.data() as HistoryLike)))
    review.push(
      `EXPEDIENTE ${data.numeroRadicado}: "${name}" lo tuvo asignado y no coincide con ningún usuario.`,
    )
  if (Object.keys(fields).length) changes.push({ ref: snapshot.ref, fields, previous })
}

for (const snapshot of filings.docs) {
  const data = snapshot.data()
  const participants = participantsByExpedient.get(data.expedienteId)
  if (!participants) {
    review.push(`RADICADO ${data.numero}: su expediente ${data.expedienteId} no existe.`)
    continue
  }
  const fields: Record<string, unknown> = {}
  const previous: Record<string, unknown> = {}
  if (data.dependencia !== dependencyByExpedient.get(data.expedienteId)) {
    fields.dependencia = dependencyByExpedient.get(data.expedienteId)
    previous.dependencia = data.dependencia ?? null
  }
  if ((data.participantes ?? []).length !== participants.length) {
    fields.participantes = participants
    previous.participantes = data.participantes ?? null
  }
  if (Object.keys(fields).length) changes.push({ ref: snapshot.ref, fields, previous })
}

// Índice del radicado de entrada, que las reglas exigen para que no se repita.
const claimed = new Map(entryFilings.docs.map((entry) => [entry.id, entry.data().expedienteId]))
for (const snapshot of expedients.docs) {
  const number = String(snapshot.data().numeroRadicado ?? '').trim()
  if (!number || number.includes('/')) {
    review.push(`EXPEDIENTE ${snapshot.id}: radicado de entrada "${number}" no sirve como índice.`)
    continue
  }
  const owner = claimed.get(number)
  if (owner === snapshot.id) continue
  if (owner) {
    review.push(
      `RADICADO DE ENTRADA ${number}: lo tienen los expedientes ${owner} y ${snapshot.id}.`,
    )
    continue
  }
  claimed.set(number, snapshot.id)
  changes.push({
    ref: firestore.collection('radicadosEntrada').doc(number),
    fields: { expedienteId: snapshot.id },
    previous: {},
    create: true,
  })
}

const count = (collection: string, field: string) =>
  changes.filter((change) => change.ref.parent.id === collection && field in change.fields).length
console.log(`Lecturas usadas: ${reads} (cuota gratuita: 50.000 al día).`)
console.log(`Documentos a escribir: ${changes.length} (cuota gratuita: 20.000 al día).`)
console.log(
  `  expedientes: área ${count('expedientes', 'dependencia')}, participantes ${count('expedientes', 'participantes')}, fecha de cierre ${count('expedientes', 'fechaCierre')}`,
)
console.log(
  `  radicados: área ${count('radicados', 'dependencia')}, participantes ${count('radicados', 'participantes')}`,
)
console.log(`  usuarios: área ${count('usuarios', 'dependencia')}`)
console.log(`  índice de radicados de entrada: ${count('radicadosEntrada', 'expedienteId')}`)
if (review.length) console.log(`\nPara revisar (${review.length}):\n${review.join('\n')}`)

if (!apply) {
  console.log('\nSimulación: no se escribió nada. Vuelve a ejecutar con --apply para aplicar.')
  process.exit(0)
}
if (!changes.length) {
  console.log('\nNo hay nada que aplicar.')
  process.exit(0)
}

mkdirSync('backups', { recursive: true })
const backupFile = path.join(
  'backups',
  `migrate-dependencies-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
)
const backup: BackupEntry[] = changes.map((change) => ({
  path: change.ref.path,
  previous: change.previous,
  ...(change.create ? { created: true } : {}),
}))
writeFileSync(backupFile, JSON.stringify(backup, null, 2))
console.log(`\nCopia de los valores anteriores: ${backupFile}`)
await commitInChunks(
  changes.map((change) => ({
    ref: change.ref,
    mode: change.create ? 'create' : 'update',
    data: change.fields,
  })),
)
console.log(
  `Aplicado. Para deshacer: npx tsx scripts/migrate-dependencies.ts --restore=${backupFile}`,
)
