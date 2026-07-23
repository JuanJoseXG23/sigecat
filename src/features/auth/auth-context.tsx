import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  AuthenticationError,
  signIn,
  signOutUser,
  subscribeToAuthState,
} from '@/services/auth.service'
import { getUserProfile, updateLastLogin } from '@/services/user-profile.service'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type Credentials,
} from '@/features/auth/auth-context-value'
import type { UserProfile } from '@/types/user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const loadProfile = useCallback(async (authenticatedUser: User): Promise<UserProfile | null> => {
    const userProfile = await getUserProfile(authenticatedUser.uid)

    if (!userProfile?.activo) {
      return null
    }

    return userProfile
  }, [])

  useEffect(() => {
    let active = true
    const unsubscribe = subscribeToAuthState((authenticatedUser) => {
      void (async () => {
        if (!authenticatedUser) {
          if (active) {
            setUser(null)
            setProfile(null)
            setStatus('unauthenticated')
          }
          return
        }

        try {
          const userProfile = await loadProfile(authenticatedUser)

          if (!userProfile) {
            await signOutUser()
            return
          }

          if (active) {
            setUser(authenticatedUser)
            setProfile(userProfile)
            setStatus('authenticated')
          }
        } catch {
          await signOutUser()
        }
      })()
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [loadProfile])

  const signInWithCredentials = useCallback(
    async ({ email, password }: Credentials) => {
      const authenticatedUser = await signIn(email, password)
      const userProfile = await loadProfile(authenticatedUser)

      if (!userProfile) {
        await signOutUser()
        throw new AuthenticationError('Tu cuenta no está activa o no tiene un perfil autorizado.')
      }

      await updateLastLogin(authenticatedUser.uid)
      setUser(authenticatedUser)
      setProfile(userProfile)
      setStatus('authenticated')
    },
    [loadProfile],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      status,
      signInWithCredentials,
      signOut: signOutUser,
      hasRole: (roles) => profile !== null && roles.includes(profile.rol),
    }),
    [profile, signInWithCredentials, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
