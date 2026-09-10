import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { UserRole } from '../src/types/user.js'

interface SeedUser {
  nombreCompleto: string
  correo: string
  passwordEnvironment: string
  cargo: string
  rol: UserRole
}

const initialUsers: SeedUser[] = [
  {
    nombreCompleto: 'Juan Jose Gomez Roldan',
    correo: 'auxiliar.catastro3@girardota.gov.co',
    passwordEnvironment: 'SIGECAT_SEED_ADMIN_PASSWORD',
    cargo: 'Auxiliar Administrativo',
    rol: 'Administrador',
  },
  {
    nombreCompleto: 'John Fredy Mejia Martinez',
    correo: 'hacienda.catastro@girardota.gov.co',
    passwordEnvironment: 'SIGECAT_SEED_COORDINATOR_PASSWORD',
    cargo: 'Profesional Universitario',
    rol: 'Coordinador',
  },
  {
    nombreCompleto: 'Doricela Bustamante Hoyos',
    correo: 'tecnico.catastro@girardota.gov.co',
    passwordEnvironment: 'SIGECAT_SEED_OFFICIAL_1_PASSWORD',
    cargo: 'Técnico Administrativo',
    rol: 'Funcionario',
  },
  {
    nombreCompleto: 'Juan David Henao Vanegas',
    correo: 'apoyo.catastro@girardota.gov.co',
    passwordEnvironment: 'SIGECAT_SEED_OFFICIAL_2_PASSWORD',
    cargo: 'Apoyo Administrativo',
    rol: 'Funcionario',
  },
]

const serviceAccountPath = path.resolve(
  process.cwd(),
  process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH ?? 'secrets/firebase-admin.json',
)

const resetPasswords = process.env.SIGECAT_RESET_SEED_PASSWORDS === 'true'

function getRequiredPassword(seedUser: SeedUser): string {
  const password = process.env[seedUser.passwordEnvironment]
  if (!password) {
    throw new Error(
      `Falta la variable de entorno ${seedUser.passwordEnvironment}. No incluyas contraseñas en el repositorio.`,
    )
  }
  return password
}

const serviceAccount = JSON.parse(
  readFileSync(serviceAccountPath, 'utf8'),
)

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      })

const auth = getAuth(app)
const firestore = getFirestore(app)

async function seedInitialUser(seedUser: SeedUser): Promise<void> {
  let uid: string
  let authStatus: 'creado' | 'ya existía'

  try {
    const existingUser = await auth.getUserByEmail(seedUser.correo)
    uid = existingUser.uid
    authStatus = 'ya existía'
  } catch (error: unknown) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'auth/user-not-found') {
      throw error
    }

    const createdUser = await auth.createUser({
      email: seedUser.correo,
      password: getRequiredPassword(seedUser),
      displayName: seedUser.nombreCompleto,
      disabled: false,
    })

    uid = createdUser.uid
    authStatus = 'creado'
  }

  if (authStatus === 'ya existía' && resetPasswords) {
    await auth.updateUser(uid, { password: getRequiredPassword(seedUser) })
  }

  const userDocument = firestore.collection('usuarios').doc(uid)
  const snapshot = await userDocument.get()

  let profileStatus = 'ya existía'

  if (!snapshot.exists) {
    await userDocument.set({
      uid,
      nombreCompleto: seedUser.nombreCompleto,
      correo: seedUser.correo,
      cargo: seedUser.cargo,
      rol: seedUser.rol,
      activo: true,
      fechaCreacion: FieldValue.serverTimestamp(),
      ultimoIngreso: null,
    })

    profileStatus = 'creado'
  }

  console.log(
    `✅ ${seedUser.correo} -> Authentication: ${authStatus} | Firestore: ${profileStatus}`,
  )
}

async function main() {
  console.log('🚀 Inicializando usuarios de SIGECAT...\n')

  for (const user of initialUsers) {
    await seedInitialUser(user)
  }

  console.log('\n🎉 Inicialización completada.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
