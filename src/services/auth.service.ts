import { FirebaseError } from 'firebase/app'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth, authPersistenceReady } from '@/services/firebase'

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  try {
    await authPersistenceReady
    const credential = await signInWithEmailAndPassword(auth, email, password)
    return credential.user
  } catch (error) {
    throw new AuthenticationError(getAuthenticationErrorMessage(error))
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  let unsubscribe: () => void = () => undefined
  let cancelled = false

  void authPersistenceReady
    .then(() => {
      if (!cancelled) {
        unsubscribe = onAuthStateChanged(auth, callback)
      }
    })
    .catch(() => callback(null))

  return () => {
    cancelled = true
    unsubscribe()
  }
}

function getAuthenticationErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return 'No fue posible iniciar sesión. Intenta nuevamente.'
  }

  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'El correo o la contraseña son incorrectos.'
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos antes de intentarlo otra vez.'
    case 'auth/network-request-failed':
      return 'No hay conexión disponible. Verifica tu red e inténtalo nuevamente.'
    default:
      return 'No fue posible iniciar sesión. Intenta nuevamente.'
  }
}
