import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { firestore } from '@/services/firebase'
import type { Expedient, ScannedDocument } from '@/types/expedient'

export async function getExpedientsWithDocuments(): Promise<
  Array<Expedient & { documentos: ScannedDocument[] }>
> {
  try {
    // Obtener todos los expedientes activos
    const expedientesSnapshot = await getDocs(
      query(
        collection(firestore, 'expedientes'),
        where('activo', '==', true),
        orderBy('numeroRadicado', 'desc')
      )
    )

    const expedients = expedientesSnapshot.docs.map((doc) => doc.data() as Expedient)

    // Para cada expediente, obtener sus documentos
    const result = await Promise.all(
      expedients.map(async (expediente) => {
        const docsSnapshot = await getDocs(
          query(
            collection(firestore, 'documentosEscaneados'),
            where('expedientId', '==', expediente.id),
            orderBy('fechaEscaneo', 'desc')
          )
        )
        const documentos = docsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as ScannedDocument))
        return { ...expediente, documentos }
      })
    )

    // Filtrar solo expedientes que tengan documentos
    return result.filter((item) => item.documentos.length > 0)
  } catch (error) {
    console.error('Error obteniendo expedientes con documentos:', error)
    return []
  }
}
