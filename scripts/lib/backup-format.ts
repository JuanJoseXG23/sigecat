import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { ServiceAccount } from 'firebase-admin/app'
import { GeoPoint, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore'

/**
 * Formato de las copias de seguridad de SIGECAT: el de backupFirestore en
 * google-apps-script/Code.gs, que guarda cada documento tal como lo devuelve la API REST de
 * Firestore (con el tipo de cada valor). Lo comparten export-backup, restore-backup y
 * recovery-drill.
 */

/** Colecciones copiadas; debe coincidir con BACKUP_COLLECTIONS de Code.gs. */
export const BACKUP_COLLECTIONS = [
  'usuarios',
  'directorioUsuarios',
  'expedientes',
  'historial',
  'radicados',
  'radicadosEntrada',
  'tiposTramite',
  'configuracion',
  'tareas',
  'notificacionesAsignacion',
  'consultasDireccion',
  'solicitudesPruebaCorreo',
  'recordatorios',
] as const

export interface RestValue {
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

export interface BackupDocument {
  /** projects/{proyecto}/databases/(default)/documents/{ruta} */
  name: string
  fields: Record<string, RestValue>
  updateTime: string
}

export interface Backup {
  proyecto: string
  fecha: string
  colecciones: Record<string, number>
  documentos: BackupDocument[]
}

export function readBackup(file: string): Backup {
  const raw = readFileSync(file)
  return JSON.parse((file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8')) as Backup
}

/** Huella para comprobar que el archivo no se dañó ni se cambió. */
export function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/** Cuenta de servicio de Firebase Admin (ver README). */
export function loadServiceAccount(): ServiceAccount & { project_id: string } {
  const serviceAccountPath = path.resolve(
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH?.trim().replace(/^["']|["']$/g, '') ||
      'secrets/firebase-admin.json',
  )
  return JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
}

/** "projects/p/databases/(default)/documents/expedientes/x" → "expedientes/x" */
export function toPath(name: string): string {
  return name.split('/documents/')[1]
}

/** Colección del documento: "expedientes/x/historial/y" → "historial". */
export function collectionOf(documentPath: string): string {
  const parts = documentPath.split('/')
  return parts[parts.length - 2]
}

/** Valor REST (el que guarda la copia) al del SDK de administración. */
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

export function fromRestFields(fields: Record<string, RestValue>, db: Firestore): DocumentData {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromRest(value, db)]),
  )
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

/** Si el documento actual se modificó después de la copia. */
export function isNewer(current: Timestamp, backupTime: string): boolean {
  const [seconds, nanos] = toPreciseTime(backupTime)
  return current.seconds > seconds || (current.seconds === seconds && current.nanoseconds > nanos)
}

/** Documentos por colección, para comparar con `colecciones` de la copia. */
export function countByCollection(documents: BackupDocument[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const document of documents) {
    const collection = collectionOf(toPath(document.name))
    counts[collection] = (counts[collection] ?? 0) + 1
  }
  return counts
}
