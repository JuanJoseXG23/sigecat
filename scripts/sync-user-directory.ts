import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Reconstruye directorioUsuarios a partir de usuarios. Es idempotente: se puede ejecutar
 * cuantas veces haga falta, por ejemplo si un perfil se editó desde la consola de Firebase.
 *
 * npm run users:sync-directory
 */
const serviceAccountPath = path.resolve(
  process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH?.trim().replace(/^["']|["']$/g, '') ||
    'secrets/firebase-admin.json',
)
const app =
  getApps()[0] ??
  initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const firestore = getFirestore(app)

const [users, directory] = await Promise.all([
  firestore.collection('usuarios').get(),
  firestore.collection('directorioUsuarios').get(),
])
const batch = firestore.batch()
for (const user of users.docs) {
  const { nombreCompleto, rol, activo } = user.data()
  batch.set(firestore.collection('directorioUsuarios').doc(user.id), {
    uid: user.id,
    nombreCompleto,
    rol,
    activo: activo === true,
  })
}
const orphans = directory.docs.filter((entry) => !users.docs.some((user) => user.id === entry.id))
orphans.forEach((entry) => batch.delete(entry.ref))
await batch.commit()
process.stdout.write(
  `Directorio sincronizado: ${users.size} usuarios, ${orphans.length} entradas huérfanas eliminadas.
`,
)
