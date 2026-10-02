import { collection, getDocs, type Timestamp } from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import { WORKFLOW_DOCUMENT_LABELS, type Expedient, type WorkflowDocument } from '@/types/expedient'

export interface LibraryDocument {
  id: string
  nombre: string
  tipo: string
  url: string
  fecha: Timestamp | null
  radicado?: string
  folios?: number
}

export interface LibraryExpedient extends Expedient {
  documentos: LibraryDocument[]
}

function toLibraryDocument(document: WorkflowDocument): LibraryDocument {
  return {
    id: document.id,
    nombre: document.nombre,
    tipo: WORKFLOW_DOCUMENT_LABELS[document.tipo] ?? document.tipo,
    url: document.url,
    fecha: document.fecha ?? null,
    radicado: document.radicadoNumero,
    folios: document.folios,
  }
}

function timestampValue(timestamp: Timestamp | null | undefined): number {
  return timestamp?.toMillis() ?? 0
}

/** Construye la biblioteca desde los documentos asociados a cada expediente. */
export async function getExpedientsWithDocuments(): Promise<LibraryExpedient[]> {
  const snapshot = await getDocs(collection(firestore, 'expedientes'))

  return snapshot.docs
    .map((item) => {
      const expedient = { ...item.data(), id: item.id } as Expedient
      const documents = (expedient.documentosWorkflow ?? [])
        .map(toLibraryDocument)
        .sort((first, second) => timestampValue(second.fecha) - timestampValue(first.fecha))
      return { ...expedient, documentos: documents }
    })
    .filter((expedient) => expedient.documentos.length > 0)
    .sort(
      (first, second) =>
        timestampValue(second.fechaActualizacion) - timestampValue(first.fechaActualizacion),
    )
}
