import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { cert } from 'firebase-admin/app'
import {
  BACKUP_COLLECTIONS,
  loadServiceAccount,
  sha256,
  type BackupDocument,
} from './lib/backup-format.js'

/**
 * Saca en este equipo una copia completa de Firestore, en el mismo formato que la copia diaria
 * de Drive, para guardarla fuera de la nube (disco externo cifrado o carpeta institucional
 * restringida). Solo lee: no modifica la base. Cuenta para la cuota diaria de lecturas.
 *
 * La copia CONTIENE DATOS PERSONALES (Ley 1581 de 2012): no la guarde en OneDrive personal, el
 * escritorio ni carpetas compartidas.
 *
 * npx tsx scripts/export-backup.ts --out=E:\copias-sigecat
 */
const out = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6)
if (!out) throw new Error('Indica la carpeta de destino con --out=ruta')
if (/onedrive|desktop|escritorio/i.test(path.resolve(out)))
  console.warn(
    'ADVERTENCIA: la carpeta parece sincronizada o de uso general; la copia tiene datos personales.',
  )

const account = loadServiceAccount()
const token = (await cert(account).getAccessToken()).access_token
const documents: BackupDocument[] = []
const counts: Record<string, number> = {}
for (const collectionId of BACKUP_COLLECTIONS) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // El historial vive dentro de cada expediente: se pide como grupo de colecciones.
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId, allDescendants: collectionId === 'historial' }],
        },
      }),
    },
  )
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${await response.text()}`)
  const rows = (await response.json()) as { document?: BackupDocument }[]
  counts[collectionId] = 0
  for (const { document } of rows) {
    if (!document) continue
    documents.push({
      name: document.name,
      fields: document.fields ?? {},
      updateTime: document.updateTime,
    })
    counts[collectionId] += 1
  }
}

const createdAt = new Date()
const stamp = createdAt.toISOString().slice(0, 16).replace('T', '_').replace(':', '')
const file = path.join(out, `sigecat-${stamp}-local.json.gz`)
writeFileSync(
  file,
  gzipSync(
    JSON.stringify({
      proyecto: account.project_id,
      fecha: createdAt.toISOString(),
      colecciones: counts,
      documentos: documents,
    }),
  ),
)
console.log(`Copia: ${file}`)
console.log(`Documentos: ${documents.length} ${JSON.stringify(counts)}`)
console.log(`SHA-256: ${sha256(file)}  (anótela junto a la copia para verificarla después)`)
