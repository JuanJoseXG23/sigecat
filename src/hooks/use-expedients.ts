import { useQuery } from '@tanstack/react-query'
import { useParticipantScope } from '@/hooks/use-participant-scope'
import { listExpedients } from '@/services/expedient.service'

export function useExpedients() {
  const participant = useParticipantScope()
  return useQuery({
    queryKey: ['expedients', participant ?? 'todos'],
    queryFn: () => listExpedients(participant),
  })
}
