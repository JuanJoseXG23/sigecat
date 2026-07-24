import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { UserProfile } from '@/types/user'

const USERS_COLLECTION = 'usuarios'

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(firestore, USERS_COLLECTION, uid))

  return snapshot.exists() ? (snapshot.data() as UserProfile) : null
}

export async function updateLastLogin(uid: string): Promise<void> {
  await updateDoc(doc(firestore, USERS_COLLECTION, uid), {
    ultimoIngreso: serverTimestamp(),
  })
}

export async function listAssignableOfficials(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(firestore, USERS_COLLECTION))

  return snapshot.docs
    .map((item) => item.data() as UserProfile)
    .filter((user) => user.activo && (user.rol === 'Funcionario' || user.rol === 'Coordinador'))
    .sort((first, second) => first.nombreCompleto.localeCompare(second.nombreCompleto))
}

export async function listUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(firestore, USERS_COLLECTION))
  return snapshot.docs.map((item) => item.data() as UserProfile).sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
}

export async function saveUserProfile(values: Omit<UserProfile, 'fechaCreacion' | 'ultimoIngreso'>): Promise<void> {
  const reference = doc(firestore, USERS_COLLECTION, values.uid)
  const current = await getDoc(reference)
  if (current.exists()) await updateDoc(reference, { ...values })
  else await setDoc(reference, { ...values, fechaCreacion: serverTimestamp(), ultimoIngreso: null })
}

export async function setUserActive(uid: string, activo: boolean): Promise<void> {
  await updateDoc(doc(firestore, USERS_COLLECTION, uid), { activo })
}
