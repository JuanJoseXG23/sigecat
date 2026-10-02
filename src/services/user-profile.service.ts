import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { UserProfile } from '@/types/user'

const USERS_COLLECTION = 'usuarios'
const DIRECTORY_COLLECTION = 'directorioUsuarios'

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(firestore, USERS_COLLECTION, uid))

  return snapshot.exists() ? (snapshot.data() as UserProfile) : null
}

export async function updateLastLogin(uid: string): Promise<void> {
  await updateDoc(doc(firestore, USERS_COLLECTION, uid), {
    ultimoIngreso: serverTimestamp(),
  })
}

/**
 * Copia mínima del perfil (sin correo ni cargo) que cualquier sesión activa puede leer
 * para elegir o filtrar responsables. Solo el Administrador la escribe, siempre en el
 * mismo lote que el perfil completo.
 */
export type DirectoryEntry = Pick<UserProfile, 'uid' | 'nombreCompleto' | 'rol' | 'activo'>

function setDirectoryEntry(batch: WriteBatch, profile: DirectoryEntry): void {
  batch.set(
    doc(firestore, DIRECTORY_COLLECTION, profile.uid),
    {
      uid: profile.uid,
      nombreCompleto: profile.nombreCompleto,
      rol: profile.rol,
      activo: profile.activo,
    },
    { merge: true },
  )
}

function isAssignable(user: DirectoryEntry): boolean {
  return user.activo && (user.rol === 'Funcionario' || user.rol === 'Coordinador')
}

function byName(first: DirectoryEntry, second: DirectoryEntry): number {
  return first.nombreCompleto.localeCompare(second.nombreCompleto)
}

/** Todo el directorio, activos e inactivos: sirve para mostrar nombres en el historial. */
export async function listDirectory(): Promise<DirectoryEntry[]> {
  const snapshot = await getDocs(collection(firestore, DIRECTORY_COLLECTION))
  return snapshot.docs.map((item) => item.data() as DirectoryEntry).sort(byName)
}

export async function listAssignableOfficials(): Promise<DirectoryEntry[]> {
  return (await listDirectory()).filter(isAssignable)
}

export async function listUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(firestore, USERS_COLLECTION))
  return snapshot.docs.map((item) => item.data() as UserProfile).sort(byName)
}

/** Perfiles completos de quienes pueden recibir alertas; solo para el Administrador. */
export async function listAlertRecipients(): Promise<UserProfile[]> {
  return (await listUsers()).filter(isAssignable)
}

export async function saveUserProfile(
  values: Omit<UserProfile, 'fechaCreacion' | 'ultimoIngreso'>,
): Promise<void> {
  const reference = doc(firestore, USERS_COLLECTION, values.uid)
  const current = await getDoc(reference)
  const batch = writeBatch(firestore)
  if (current.exists()) batch.update(reference, { ...values })
  else batch.set(reference, { ...values, fechaCreacion: serverTimestamp(), ultimoIngreso: null })
  setDirectoryEntry(batch, values)
  await batch.commit()
}

export async function setUserActive(profile: UserProfile, activo: boolean): Promise<void> {
  const batch = writeBatch(firestore)
  batch.update(doc(firestore, USERS_COLLECTION, profile.uid), { activo })
  setDirectoryEntry(batch, { ...profile, activo })
  await batch.commit()
}

export async function setDeadlineEmailAlerts(
  uid: string,
  recibeAlertasVencimiento: boolean,
): Promise<void> {
  await updateDoc(doc(firestore, USERS_COLLECTION, uid), { recibeAlertasVencimiento })
}
