import { collection, getDocs, type Timestamp } from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { Expedient, ScannedDocument, WorkflowDocument } from '@/types/expedient'

export interface LibraryDocument {
  id: string
  nombre: string
  tipo: string
  url: string
  fecha: Timestamp | null
  radicado?: string
}

export interface LibraryExpedient extends Expedient {
  documentos: LibraryDocument[]
}

interface StoredScannedDocument extends ScannedDocument {
  expedientId?: string
}

const workflowDocumentLabels: Record<WorkflowDocument['tipo'], string> = {
  RECIBIDO: 'Documento recibido',
  RADICADO_SALIDA: 'Respuesta radicada',
  TRASLADO: 'Documento de traslado',
}

function normalizeWorkflowDocument(document: WorkflowDocument): LibraryDocument {
  return {
    id: `workflow-${document.id}`,
    nombre: document.nombre,
    tipo: workflowDocumentLabels[document.tipo],
    url: document.url,
    fecha: document.fecha ?? null,
    radicado: document.radicadoNumero,
  }
}

function normalizeLegacyDocument(document: StoredScannedDocument): LibraryDocument {
  return {
    id: `legacy-${document.id}`,
    nombre: document.tipo,
    tipo: document.tipo,
    url: document.urlOneDrive,
    fecha: document.fechaEscaneo ?? null,
    radicado: document.radicado,
  }
}

function timestampValue(timestamp: Timestamp | null | undefined): number {
  return timestamp?.toMillis() ?? 0
}

/**
 * Construye la biblioteca desde los documentos realmente asociados a cada expediente.
 * También incorpora registros antiguos de documentosEscaneados para no perder consultas.
 */
export async function getExpedientsWithDocuments(): Promise<LibraryExpedient[]> {
  const [expedientsSnapshot, legacyDocumentsSnapshot] = await Promise.all([
    getDocs(collection(firestore, 'expedientes')),
    getDocs(collection(firestore, 'documentosEscaneados')).catch(() => null),
  ])

  const legacyDocumentsByExpedient = new Map<string, LibraryDocument[]>()
  legacyDocumentsSnapshot?.docs.forEach((snapshot) => {
    const data = snapshot.data() as StoredScannedDocument
    if (!data.expedientId || !data.urlOneDrive) return

    const document = normalizeLegacyDocument({ ...data, id: snapshot.id })
    const documents = legacyDocumentsByExpedient.get(data.expedientId) ?? []
    documents.push(document)
    legacyDocumentsByExpedient.set(data.expedientId, documents)
  })

  return expedientsSnapshot.docs
    .map((snapshot) => {
      const expedient = { ...snapshot.data(), id: snapshot.id } as Expedient
      const workflowDocuments = (expedient.documentosWorkflow ?? []).map(normalizeWorkflowDocument)
      const legacyDocuments = legacyDocumentsByExpedient.get(expedient.id) ?? []
      const embeddedLegacyDocuments = (expedient.documentosEscaneados ?? []).map(
        normalizeLegacyDocument,
      )

      const documents = [...workflowDocuments, ...legacyDocuments, ...embeddedLegacyDocuments]
        .filter(
          (document, index, list) => list.findIndex((item) => item.id === document.id) === index,
        )
        .sort((first, second) => timestampValue(second.fecha) - timestampValue(first.fecha))

      return { ...expedient, documentos: documents }
    })
    .filter((expedient) => expedient.documentos.length > 0)
    .sort(
      (first, second) =>
        timestampValue(second.fechaActualizacion) - timestampValue(first.fechaActualizacion),
    )
}
