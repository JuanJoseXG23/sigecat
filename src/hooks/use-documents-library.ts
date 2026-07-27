import { useQuery } from '@tanstack/react-query'
import { getExpedientsWithDocuments } from '@/services/documents-library.service'

export function useDocumentsLibrary() {
  return useQuery({
    queryKey: ['documents-library'],
    queryFn: getExpedientsWithDocuments,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}
