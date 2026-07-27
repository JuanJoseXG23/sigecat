import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addExpedientWorkflowDocument } from '@/services/expedient.service'
import type { WorkflowDocumentPayload } from '@/types/expedient'

export function useAddExpedientWorkflowDocument() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async ({
      expedientId,
      documentData,
      userId,
      userName,
    }: {
      expedientId: string
      // Workflow document payload without id/fecha; may include radicadoFecha as string
      documentData: WorkflowDocumentPayload
      userId: string
      userName: string
    }) => addExpedientWorkflowDocument(expedientId, documentData, userId, userName),
    onSuccess: (_, { expedientId }) => {
      client.invalidateQueries({ queryKey: ['expedient', expedientId] })
      client.invalidateQueries({ queryKey: ['expedient-history', expedientId] })
      client.invalidateQueries({ queryKey: ['expedients'] })
      client.invalidateQueries({ queryKey: ['work-tray'] })
      client.invalidateQueries({ queryKey: ['historical-expedients'] })
      client.invalidateQueries({ queryKey: ['filings'] })
    },
  })
}
