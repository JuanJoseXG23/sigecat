import { useQuery } from '@tanstack/react-query'
import { useParticipantScope } from '@/hooks/use-participant-scope'
import { listClosedExpedientsInYear, listHistoricalExpedients } from '@/services/expedient.service'

/**
 * Cerrados en el año elegido (sin año, todos). El Funcionario recibe todos los suyos, que son
 * pocos, y la pantalla filtra el año.
 */
export function useHistoricalExpedients(year?: number) {
  const participant = useParticipantScope()
  return useQuery({
    queryKey: [
      'historical-expedients',
      participant ?? 'todos',
      participant ? 'todos' : (year ?? 'todos'),
    ],
    queryFn: () =>
      participant ? listHistoricalExpedients(participant) : listClosedExpedientsInYear(year),
  })
}
