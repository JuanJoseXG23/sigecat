import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
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
