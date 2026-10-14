import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { listDirectory } from '@/services/user-profile.service'

/** uid con el que se guardan las acciones automáticas (scripts y Apps Script). */
export const SYSTEM_USER = 'sistema'

export interface UserLabel {
  name: string
  /** Rol en SIGECAT, o "Automático" para las acciones del sistema. */
  role?: string
  system: boolean
}

/** Nombre y rol de cada usuario por uid, para mostrar quién hizo cada actuación. */
export function useUserLabels(): (uid: string) => UserLabel {
  const { data = [] } = useQuery({ queryKey: ['user-directory'], queryFn: listDirectory })
  return useMemo(() => {
    const users = new Map(data.map((entry) => [entry.uid, entry]))
    return (uid: string) => {
      if (uid === SYSTEM_USER) return { name: 'SIGECAT', role: 'Automático', system: true }
      const user = users.get(uid)
      return user
        ? { name: user.nombreCompleto, role: user.rol, system: false }
        : { name: 'Usuario no encontrado', system: false }
    }
  }, [data])
}

/** Solo el nombre; ver useUserLabels. */
export function useUserNames(): (uid: string) => string {
  const labelOf = useUserLabels()
  return (uid: string) => labelOf(uid).name
}
