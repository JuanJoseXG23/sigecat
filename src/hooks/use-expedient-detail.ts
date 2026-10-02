import { useQuery } from '@tanstack/react-query'
import { getExpedient, listExpedientHistory } from '@/services/expedient.service'

export function useExpedientDetail(id?: string) {
  return useQuery({
    queryKey: ['expedient', id],
    queryFn: () => getExpedient(id!),
    enabled: Boolean(id),
  })
}

export function useExpedientHistory(id?: string) {
  return useQuery({
    queryKey: ['expedient-history', id],
    queryFn: () => listExpedientHistory(id!),
    enabled: Boolean(id),
  })
}
