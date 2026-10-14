import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import {
  GeoPoint,
  getFirestore,
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore'

/**
 * Restaura una copia de seguridad hecha por backupFirestore (google-apps-script/Code.gs).
 *
 * Sin --apply solo compara la copia con la base actual: qué documentos faltan y cuáles
 * cambiaron después de la copia. Con --apply crea únicamente los que faltan; para devolver
 * también los que cambiaron hay que añadir --overwrite. Nunca borra documentos.
 *
 * npx tsx scripts/restore-backup.ts --file=sigecat-2026-10-14_0200.json.gz
 *   [--collections=expedientes,historial] [--apply] [--overwrite]
 */
const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const file = option('file')
const only = option('collections')?.split(',')
const apply = process.argv.includes('--apply')
const overwrite = process.argv.includes('--overwrite')
if (!file) throw new Error('Indica la copia con --file=ruta/al/archivo.json.gz')

interface RestValue {
  stringValue?: string
  integerValue?: string
  doubleValue?: number
  booleanValue?: boolean
  nullValue?: null
  timestampValue?: string
  referenceValue?: string
  bytesValue?: string
  geoPointValue?: { latitude?: number; longitude?: number }
  mapValue?: { fields?: Record<string, RestValue> }
  arrayValue?: { values?: RestValue[] }
}

interface BackupDocument {
  name: string
  fields: Record<string, RestValue>
  updateTime: string
}

interface Backup {
  proyecto: string
  fecha: string
  colecciones: Record<string, number>
  documentos: BackupDocument[]
}

const raw = readFileSync(file)
const backup = JSON.parse((file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8')) as Backup

const serviceAccountPath = path.resolve(
  process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH?.trim().replace(/^["']|["']$/g, '') ||
    'secrets/firebase-admin.json',
)
const account = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
if (account.project_id !== backup.proyecto)
  throw new Error(`La copia es del proyecto ${backup.proyecto}, no de ${account.project_id}.`)
const app = getApps()[0] ?? initializeApp({ credential: cert(account) })
const firestore = getFirestore(app)

/** Valor del formato REST de Firestore (el que guarda Apps Script) al del SDK de administración. */
function fromRest(value: RestValue, db: Firestore): unknown {
  if (value.stringValue !== undefined) return value.stringValue
  if (value.integerValue !== undefined) return Number(value.integerValue)
  if (value.doubleValue !== undefined) return value.doubleValue
  if (value.booleanValue !== undefined) return value.booleanValue
  if (value.timestampValue !== undefined) return Timestamp.fromDate(new Date(value.timestampValue))
  if (value.referenceValue !== undefined) return db.doc(toPath(value.referenceValue))
  if (value.bytesValue !== undefined) return Buffer.from(value.bytesValue, 'base64')
  if (value.geoPointValue)
    return new GeoPoint(value.geoPointValue.latitude ?? 0, value.geoPointValue.longitude ?? 0)
  if (value.mapValue) return fromRestFields(value.mapValue.fields ?? {}, db)
  if (value.arrayValue) return (value.arrayValue.values ?? []).map((item) => fromRest(item, db))
  return null
}

function fromRestFields(fields: Record<string, RestValue>, db: Firestore): DocumentData {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromRest(value, db)]),
  )
}

/** "projects/p/databases/(default)/documents/expedientes/x" → "expedientes/x" */
function toPath(name: string): string {
  return name.split('/documents/')[1]
}

/**
 * Hora RFC 3339 con nanosegundos ("2026-10-14T03:53:39.659123Z") en segundos y nanosegundos;
 * Date la recortaría a milisegundos y todo parecería modificado después de la copia.
 */
function toPreciseTime(value: string): [number, number] {
  const match = /^(.*?)(?:\.(\d+))?Z$/.exec(value)
  const base = match?.[1] ?? value
  const fraction = match?.[2] ?? ''
  const seconds = Math.floor(new Date(`${base}Z`).getTime() / 1000)
  return [seconds, Number(fraction.padEnd(9, '0').slice(0, 9))]
}

function isNewer(current: Timestamp, backupTime: string): boolean {
  const [seconds, nanos] = toPreciseTime(backupTime)
  return current.seconds > seconds || (current.seconds === seconds && current.nanoseconds > nanos)
}

/** Colección del documento; el historial se reconoce por su subcolección. */
function collectionOf(documentPath: string): string {
  const parts = documentPath.split('/')
  return parts[parts.length - 2]
}

console.log(`Copia del ${backup.fecha}: ${backup.documentos.length} documentos.`)
const selected = backup.documentos.filter(
  (document) => !only || only.includes(collectionOf(toPath(document.name))),
)
const missing: BackupDocument[] = []
const changed: BackupDocument[] = []
for (let index = 0; index < selected.length; index += 300) {
  const group = selected.slice(index, index + 300)
  const snapshots = await firestore.getAll(
    ...group.map((document) => firestore.doc(toPath(document.name))),
  )
  snapshots.forEach((snapshot, position) => {
    const document = group[position]
    if (!snapshot.exists) missing.push(document)
    else if (isNewer(snapshot.updateTime!, document.updateTime)) changed.push(document)
  })
}

const summarize = (documents: BackupDocument[]) => {
  const counts: Record<string, number> = {}
  for (const document of documents) {
    const collection = collectionOf(toPath(document.name))
    counts[collection] = (counts[collection] ?? 0) + 1
  }
  return JSON.stringify(counts)
}
console.log(`Revisados: ${selected.length}.`)
console.log(`Faltan en la base: ${missing.length} ${summarize(missing)}`)
console.log(`Cambiaron después de la copia: ${changed.length} ${summarize(changed)}`)

const toWrite = overwrite ? [...missing, ...changed] : missing
if (!apply) {
  console.log(
    `\nSimulación: no se escribió nada. Con --apply se crearían ${missing.length} documento(s)` +
      (changed.length ? `; con --overwrite además se devolverían ${changed.length}.` : '.'),
  )
  process.exit(0)
}
for (let index = 0; index < toWrite.length; index += 400) {
  const batch = firestore.batch()
  for (const document of toWrite.slice(index, index + 400))
    batch.set(firestore.doc(toPath(document.name)), fromRestFields(document.fields, firestore))
  await batch.commit()
}
console.log(`\nRestaurados ${toWrite.length} documento(s).`)
