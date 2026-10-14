import { execFileSync } from 'node:child_process'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { loadServiceAccount, readBackup, sha256 } from './lib/backup-format.js'

/**
 * Simulacro de recuperación total: "se perdió el proyecto". Sobre un emulador VACÍO restaura la
 * copia con restore-backup, recrea las cuentas con rebuild-auth-users y comprueba que esté todo:
 * los mismos documentos por colección, fechas como fechas y una cuenta para cada persona que
 * aparece en los expedientes. Nunca toca la base real: se niega a correr fuera del emulador.
 *
 * $env:BACKUP_FILE = 'E:\copias-sigecat\sigecat-....json.gz'; npm run drill
 */
const file = process.env.BACKUP_FILE
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('El simulacro solo corre en el emulador: usa npm run drill.')
if (!file) throw new Error('Indica la copia en la variable BACKUP_FILE.')

const backup = readBackup(file)
console.log(`Simulacro con ${file}`)
console.log(`Copia del ${backup.fecha}, SHA-256 ${sha256(file)}`)
const run = (script: string, ...args: string[]) =>
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', script, ...args], {
    stdio: 'inherit',
    env: process.env,
  })
run('scripts/restore-backup.ts', `--file=${file}`, '--apply')
run('scripts/rebuild-auth-users.ts', '--apply')

const app = getApps()[0] ?? initializeApp({ credential: cert(loadServiceAccount()) })
const firestore = getFirestore(app)
const auth = getAuth(app)
const problems: string[] = []

for (const [collection, expected] of Object.entries(backup.colecciones)) {
  const snapshot =
    collection === 'historial'
      ? await firestore.collectionGroup('historial').get()
      : await firestore.collection(collection).get()
  const status = snapshot.size === expected ? 'OK   ' : 'FALLA'
  console.log(`${status} ${collection}: ${snapshot.size} de ${expected}`)
  if (snapshot.size !== expected) problems.push(`${collection}: ${snapshot.size} de ${expected}`)
}

const expedients = await firestore.collection('expedientes').get()
const people = new Set<string>()
for (const expedient of expedients.docs) {
  const data = expedient.data()
  if (!(data.fechaRadicado instanceof Timestamp))
    problems.push(`${expedient.id}: fechaRadicado no quedó como fecha`)
  for (const uid of [data.creadoPor, data.funcionarioAsignado?.uid, ...(data.participantes ?? [])])
    if (uid) people.add(uid)
}
const accounts = await auth.listUsers(1000)
const accountIds = new Set(accounts.users.map((user) => user.uid))
const orphans = [...people].filter((uid) => !accountIds.has(uid))
console.log(
  `${orphans.length ? 'FALLA' : 'OK   '} cuentas: ${accounts.users.length}; personas en expedientes sin cuenta: ${orphans.length}`,
)
if (orphans.length) problems.push(`personas sin cuenta: ${orphans.join(', ')}`)

console.log(
  problems.length
    ? `\nSIMULACRO FALLIDO:\n- ${problems.join('\n- ')}`
    : '\nSIMULACRO EXITOSO: la copia reconstruye la base completa.',
)
process.exit(problems.length ? 1 : 0)
