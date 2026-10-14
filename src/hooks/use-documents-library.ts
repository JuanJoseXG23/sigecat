import { useQuery } from '@tanstack/react-query'
import { useParticipantScope } from '@/hooks/use-participant-scope'
import { getExpedientsWithDocuments } from '@/services/documents-library.service'

/** Con `year`, quien ve todo solo trae los expedientes radicados ese año. */
export function useDocumentsLibrary(year?: number) {
  const participant = useParticipantScope()
  return useQuery({
    queryKey: [
      'documents-library',
      participant ?? 'todos',
      participant ? 'todos' : (year ?? 'todos'),
    ],
    queryFn: () => getExpedientsWithDocuments(participant, participant ? undefined : year),
  })
}
