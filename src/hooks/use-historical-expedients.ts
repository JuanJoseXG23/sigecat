import { useQuery } from '@tanstack/react-query'
import { useParticipantScope } from '@/hooks/use-participant-scope'
import { listHistoricalExpedients } from '@/services/expedient.service'

export function useHistoricalExpedients() {
  const participant = useParticipantScope()
  return useQuery({
    queryKey: ['historical-expedients', participant ?? 'todos'],
    queryFn: () => listHistoricalExpedients(participant),
  })
}
