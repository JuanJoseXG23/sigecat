import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  countByCollection,
  collectionOf,
  fromRestFields,
  isNewer,
  loadServiceAccount,
  readBackup,
  sha256,
  toPath,
  type BackupDocument,
} from './lib/backup-format.js'

/**
 * Restaura una copia de seguridad (de Drive, de export-backup o de cualquier otra vía, siempre en
 * el formato de backupFirestore). Guía completa: docs/EMERGENCIA-recuperacion.md.
 *
 * Sin --apply solo compara la copia con la base actual: qué documentos faltan y cuáles
 * cambiaron después de la copia. Con --apply crea únicamente los que faltan; para devolver
 * también los que cambiaron hay que añadir --overwrite. Nunca borra documentos.
 *
 * Por seguridad solo restaura en el mismo proyecto de la copia. Si ese proyecto se perdió y hay
 * uno nuevo, --target-project=<id del nuevo> confirma que es a propósito.
 *
 * npx tsx scripts/restore-backup.ts --file=sigecat-2026-10-14_0200.json.gz
 *   [--collections=expedientes,historial] [--apply] [--overwrite] [--target-project=id]
 */
const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const file = option('file')
const only = option('collections')?.split(',')
const targetProject = option('target-project')
const apply = process.argv.includes('--apply')
const overwrite = process.argv.includes('--overwrite')
if (!file) throw new Error('Indica la copia con --file=ruta/al/archivo.json.gz')

const backup = readBackup(file)
const account = loadServiceAccount()
if (account.project_id !== (targetProject ?? backup.proyecto))
  throw new Error(
    targetProject
      ? `La cuenta de servicio es del proyecto ${account.project_id}, no de ${targetProject}.`
      : `La copia es del proyecto ${backup.proyecto} y la cuenta de servicio de ${account.project_id}. Si restauras en un proyecto nuevo, confírmalo con --target-project=${account.project_id}.`,
  )
const firestore = getFirestore(getApps()[0] ?? initializeApp({ credential: cert(account) }))

console.log(
  `Copia del ${backup.fecha} (proyecto ${backup.proyecto}): ${backup.documentos.length} documentos.`,
)
console.log(`SHA-256 del archivo: ${sha256(file)}`)
console.log(
  `Destino: ${process.env.FIRESTORE_EMULATOR_HOST ? `emulador ${process.env.FIRESTORE_EMULATOR_HOST}` : `proyecto ${account.project_id}`}`,
)
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

console.log(`Revisados: ${selected.length}.`)
console.log(`Faltan en la base: ${missing.length} ${JSON.stringify(countByCollection(missing))}`)
console.log(
  `Cambiaron después de la copia: ${changed.length} ${JSON.stringify(countByCollection(changed))}`,
)

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
