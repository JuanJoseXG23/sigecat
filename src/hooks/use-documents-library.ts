import { useQuery } from '@tanstack/react-query'
import { useParticipantScope } from '@/hooks/use-participant-scope'
import { getExpedientsWithDocuments } from '@/services/documents-library.service'

export function useDocumentsLibrary() {
  const participant = useParticipantScope()
  return useQuery({
    queryKey: ['documents-library', participant ?? 'todos'],
    queryFn: () => getExpedientsWithDocuments(participant),
  })
}
