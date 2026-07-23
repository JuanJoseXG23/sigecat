import { useQuery } from '@tanstack/react-query'
import { listExpedients } from '@/services/expedient.service'

export function useExpedients() {
  return useQuery({ queryKey: ['expedients'], queryFn: listExpedients })
}
