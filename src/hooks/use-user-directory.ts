import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { listDirectory } from '@/services/user-profile.service'

/** Nombre de cada usuario por uid, para mostrar quién hizo cada actuación. */
export function useUserNames(): (uid: string) => string {
  const { data = [] } = useQuery({ queryKey: ['user-directory'], queryFn: listDirectory })
  return useMemo(() => {
    const names = new Map(data.map((entry) => [entry.uid, entry.nombreCompleto]))
    return (uid: string) => names.get(uid) ?? 'Usuario del sistema'
  }, [data])
}
