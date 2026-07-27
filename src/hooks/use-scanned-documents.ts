import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { addScannedDocument, deleteScannedDocument, getScannedDocuments } from '@/services/scanned-documents.service'
import type { ScannedDocument } from '@/types/expedient'

export function useScannedDocuments(expedientId?: string) {
  return useQuery({
    queryKey: ['scanned-documents', expedientId],
    queryFn: () => (expedientId ? getScannedDocuments(expedientId) : Promise.resolve([])),
    enabled: !!expedientId,
  })
}

export function useAddScannedDocument() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      expedientId,
      documentData,
      userId,
    }: {
      expedientId: string
      documentData: Omit<ScannedDocument, 'id' | 'fechaEscaneo' | 'creadoPor'>
      userId: string
    }) => addScannedDocument(expedientId, documentData, userId),
    onSuccess: (_, { expedientId }) => {
      client.invalidateQueries({ queryKey: ['scanned-documents', expedientId] })
    },
  })
}

export function useDeleteScannedDocument() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) => deleteScannedDocument(documentId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['scanned-documents'] })
    },
  })
}
