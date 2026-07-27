import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addExpedientWorkflowDocument } from '@/services/expedient.service'
import type { WorkflowDocument } from '@/types/expedient'

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
      documentData: Omit<WorkflowDocument, 'id' | 'fecha'>
      userId: string
      userName: string
    }) => addExpedientWorkflowDocument(expedientId, documentData, userId, userName),
    onSuccess: (_, { expedientId }) => {
      client.invalidateQueries({ queryKey: ['expedient', expedientId] })
      client.invalidateQueries({ queryKey: ['expedient-history', expedientId] })
      client.invalidateQueries({ queryKey: ['expedients'] })
      client.invalidateQueries({ queryKey: ['work-tray'] })
      client.invalidateQueries({ queryKey: ['historical-expedients'] })
    },
  })
}
