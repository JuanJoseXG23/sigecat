import { randomBytes } from 'node:crypto'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { loadServiceAccount } from './lib/backup-format.js'

/**
 * Recrea las cuentas de Firebase Authentication a partir de la colección `usuarios`, después de
 * restaurar una copia en un proyecto nuevo (docs/EMERGENCIA-recuperacion.md). Cada cuenta se crea
 * con el MISMO uid del perfil, así que el historial, los responsables y `participantes` siguen
 * apuntando a la persona correcta. Las contraseñas no están en ninguna copia: cada quien define
 * una nueva con el enlace que imprime --links. Las cuentas inactivas se crean deshabilitadas.
 *
 * Sin --apply solo muestra qué cuentas faltan. Nunca borra ni cambia cuentas existentes.
 *
 * npx tsx scripts/rebuild-auth-users.ts [--apply] [--links]
 */
const apply = process.argv.includes('--apply')
const links = process.argv.includes('--links')
const app = getApps()[0] ?? initializeApp({ credential: cert(loadServiceAccount()) })
const auth = getAuth(app)
const profiles = await getFirestore(app).collection('usuarios').get()

let missing = 0
for (const profile of profiles.docs) {
  const data = profile.data()
  const existing = await auth.getUser(profile.id).catch((error: { code?: string }) => {
    if (error.code === 'auth/user-not-found') return null
    throw error
  })
  if (existing) {
    if (existing.email !== data.correo)
      console.log(
        `REVISAR  ${data.nombreCompleto}: la cuenta tiene ${existing.email}, el perfil ${data.correo}.`,
      )
    continue
  }
  missing++
  console.log(
    `${apply ? 'CREADA ' : 'FALTA  '} ${data.nombreCompleto} <${data.correo}> uid ${profile.id}${data.activo ? '' : ' (inactiva)'}`,
  )
  if (!apply) continue
  await auth.createUser({
    uid: profile.id,
    email: data.correo,
    displayName: data.nombreCompleto,
    // Nadie conoce esta clave: cada persona define la suya con el enlace.
    password: randomBytes(24).toString('base64url'),
    disabled: data.activo !== true,
  })
  if (links && data.activo === true)
    console.log(
      `         Enlace para definir la contraseña: ${await auth.generatePasswordResetLink(data.correo)}`,
    )
}

console.log(
  missing
    ? `${missing} cuenta(s) ${apply ? 'creadas' : 'por crear; vuelve a ejecutar con --apply (y --links para los enlaces)'}.`
    : 'Todos los perfiles tienen su cuenta.',
)
