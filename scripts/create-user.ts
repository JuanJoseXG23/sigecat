import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { USER_ROLES, type UserRole } from '../src/types/user.js'

/**
 * Crea un usuario de SIGECAT sin que nadie conozca su contraseña: la cuenta se
 * crea con una clave aleatoria que no se muestra y se imprime un enlace para que
 * la persona defina la suya.
 *
 * npm run user:create -- --nombre "Ana Pérez" --correo ana@girardota.gov.co \
 *   --cargo "Técnico" --rol Funcionario [--dependencia "Catastro"]
 */
const { values } = parseArgs({
  options: {
    nombre: { type: 'string' },
    correo: { type: 'string' },
    cargo: { type: 'string' },
    rol: { type: 'string' },
    dependencia: { type: 'string' },
  },
})

const nombreCompleto = values.nombre?.trim()
const correo = values.correo?.trim().toLowerCase()
const cargo = values.cargo?.trim()
const rol = values.rol?.trim() as UserRole | undefined
const dependencia = values.dependencia?.trim()

if (!nombreCompleto || !correo || !cargo || !rol) {
  throw new Error('Faltan datos: --nombre, --correo, --cargo y --rol son obligatorios.')
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
  throw new Error(`El correo ${correo} no es válido.`)
}
if (!USER_ROLES.includes(rol)) {
  throw new Error(`Rol inválido. Usa uno de: ${USER_ROLES.join(', ')}.`)
}

const serviceAccountPath = path.resolve(
  process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH?.trim().replace(/^["']|["']$/g, '') ||
    'secrets/firebase-admin.json',
)
const app =
  getApps()[0] ??
  initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const auth = getAuth(app)
const firestore = getFirestore(app)

const existing = await auth.getUserByEmail(correo).catch((error: { code?: string }) => {
  if (error.code === 'auth/user-not-found') return null
  throw error
})
if (existing) {
  throw new Error(`Ya existe una cuenta con el correo ${correo} (uid ${existing.uid}).`)
}

const user = await auth.createUser({
  email: correo,
  password: randomBytes(24).toString('base64url'),
  displayName: nombreCompleto,
})
try {
  await firestore
    .collection('usuarios')
    .doc(user.uid)
    .set({
      uid: user.uid,
      nombreCompleto,
      correo,
      cargo,
      ...(dependencia ? { dependencia } : {}),
      rol,
      activo: true,
      fechaCreacion: FieldValue.serverTimestamp(),
      ultimoIngreso: null,
    })
} catch (error) {
  // Sin perfil la cuenta no podría entrar; se revierte para no dejarla a medias.
  await auth.deleteUser(user.uid)
  throw error
}

const link = await auth.generatePasswordResetLink(correo)
process.stdout.write(
  `Usuario creado: ${nombreCompleto} <${correo}> · ${rol} · uid ${user.uid}\n\n` +
    `Envía este enlace a la persona para que defina su contraseña (es de un solo uso):\n${link}\n`,
)
