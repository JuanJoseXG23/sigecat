import { useQuery } from '@tanstack/react-query'
import { getExpedient, listExpedientHistory, listExpedientObservations } from '@/services/expedient.service'

export function useExpedientDetail(id?: string) {
  return useQuery({ queryKey: ['expedient', id], queryFn: () => getExpedient(id!), enabled: Boolean(id) })
}

export function useExpedientHistory(id?: string) {
  return useQuery({ queryKey: ['expedient-history', id], queryFn: () => listExpedientHistory(id!), enabled: Boolean(id) })
}

export function useExpedientObservations(id?: string) {
  return useQuery({ queryKey: ['expedient-observations', id], queryFn: () => listExpedientObservations(id!), enabled: Boolean(id) })
}
