import { Timestamp, collection, getDocs, query, where } from 'firebase/firestore'
import { getYearBounds } from '@/lib/periods'
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

/**
 * Construye la biblioteca desde los documentos asociados a cada expediente. Con `participant`
 * solo pide los expedientes donde figura esa persona, que es lo que las reglas le permiten (son
 * pocos y se filtran por año en la pantalla). Para quien ve todo, `year` limita a los radicados
 * en ese año: el archivo completo crece sin límite.
 */
export async function getExpedientsWithDocuments(
  participant?: string,
  year?: number,
): Promise<LibraryExpedient[]> {
  const expedients = collection(firestore, 'expedientes')
  const bounds = year === undefined ? undefined : getYearBounds(year)
  const snapshot = await getDocs(
    participant
      ? query(expedients, where('participantes', 'array-contains', participant))
      : bounds
        ? query(
            expedients,
            where('fechaRadicado', '>=', Timestamp.fromDate(bounds[0])),
            where('fechaRadicado', '<', Timestamp.fromDate(bounds[1])),
          )
        : expedients,
  )

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
