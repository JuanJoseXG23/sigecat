import { createContext } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile, UserRole } from '@/types/user'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface Credentials {
  email: string
  password: string
}

export interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  status: AuthStatus
  signInWithCredentials: (credentials: Credentials) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (roles: readonly UserRole[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
