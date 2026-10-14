import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { DEPENDENCIES, toDependencyId } from '../src/lib/dependencies.js'
import { USER_ROLES, type UserRole } from '../src/types/user.js'

/**
 * Crea un usuario de SIGECAT sin que nadie conozca su contraseña: la cuenta se
 * crea con una clave aleatoria que no se muestra y se imprime un enlace para que
 * la persona defina la suya.
 *
 * Con --clave se usa esa contraseña inicial (mínimo 8 caracteres) y no se imprime el
 * enlace. Entrégala solo a la persona; nunca la guardes en archivos.
 *
 * npm run user:create -- --nombre "Ana Pérez" --correo ana@girardota.gov.co \
 *   --cargo "Técnico" --rol Funcionario [--dependencia "Catastro"] [--clave "..."]
 */
const { values } = parseArgs({
  options: {
    nombre: { type: 'string' },
    correo: { type: 'string' },
    cargo: { type: 'string' },
    rol: { type: 'string' },
    dependencia: { type: 'string' },
    clave: { type: 'string' },
  },
})

const nombreCompleto = values.nombre?.trim()
const correo = values.correo?.trim().toLowerCase()
const cargo = values.cargo?.trim()
const rol = values.rol?.trim() as UserRole | undefined
const dependencia = toDependencyId(values.dependencia)
const initialPassword = values.clave

if (!nombreCompleto || !correo || !cargo || !rol) {
  throw new Error('Faltan datos: --nombre, --correo, --cargo y --rol son obligatorios.')
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
  throw new Error(`El correo ${correo} no es válido.`)
}
if (!USER_ROLES.includes(rol)) {
  throw new Error(`Rol inválido. Usa uno de: ${USER_ROLES.join(', ')}.`)
}
if (values.dependencia?.trim() && !dependencia) {
  throw new Error(
    `Área inválida. Usa una de: ${DEPENDENCIES.map((item) => item.nombre).join(', ')}.`,
  )
}
if (rol === 'Funcionario' && !dependencia) {
  throw new Error(
    'Un Funcionario necesita --dependencia: registra y ve los expedientes de su área.',
  )
}
if (initialPassword !== undefined && initialPassword.length < 8) {
  throw new Error('La clave inicial debe tener al menos 8 caracteres.')
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
  password: initialPassword ?? randomBytes(24).toString('base64url'),
  displayName: nombreCompleto,
})
try {
  const batch = firestore.batch()
  batch.set(firestore.collection('usuarios').doc(user.uid), {
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
  // Copia mínima que el resto de usuarios usa para elegir responsable.
  batch.set(firestore.collection('directorioUsuarios').doc(user.uid), {
    uid: user.uid,
    nombreCompleto,
    rol,
    activo: true,
    ...(dependencia ? { dependencia } : {}),
  })
  await batch.commit()
} catch (error) {
  // Sin perfil la cuenta no podría entrar; se revierte para no dejarla a medias.
  await auth.deleteUser(user.uid)
  throw error
}

if (initialPassword) {
  process.stdout.write(
    `Usuario creado: ${nombreCompleto} <${correo}> · ${rol} · uid ${user.uid}\n` +
      'Puede entrar con la clave inicial indicada; conviene que la cambie.\n',
  )
  process.exit(0)
}
const link = await auth.generatePasswordResetLink(correo)
process.stdout.write(
  `Usuario creado: ${nombreCompleto} <${correo}> · ${rol} · uid ${user.uid}\n\n` +
    `Envía este enlace a la persona para que defina su contraseña (es de un solo uso):\n${link}\n`,
)
