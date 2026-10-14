import { useAuth } from '@/hooks/use-auth'
import { getParticipantScope } from '@/lib/permissions'

/** uid con el que el Funcionario filtra sus consultas; undefined para quien ve todo. */
export function useParticipantScope(): string | undefined {
  return getParticipantScope(useAuth().profile)
}
