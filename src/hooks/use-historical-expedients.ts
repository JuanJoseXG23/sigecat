import { useQuery } from '@tanstack/react-query'
import { listHistoricalExpedients } from '@/services/expedient.service'

export function useHistoricalExpedients() {
  return useQuery({ queryKey: ['historical-expedients'], queryFn: listHistoricalExpedients })
}
