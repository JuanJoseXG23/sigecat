import type { DocumentType, ExpedientStatus } from '@/types/expedient'

export function getRequiredDocumentForStatus(
  currentStatus: ExpedientStatus,
  nextStatus: ExpedientStatus,
  trasladoPorCompetencia?: boolean,
): DocumentType | null {
  // Cuando va de Asignado (después de Recibido), necesita escanear el Radicado Inicial
  if (currentStatus === 'Recibido' && nextStatus === 'Asignado') {
    return 'Radicado Inicial'
  }

  // Cuando va a Radicado de salida, necesita escanear Respuesta Radicada
  if (currentStatus === 'En respuesta' && nextStatus === 'Radicado de salida') {
    return 'Respuesta Radicada'
  }

  // Si hay traslado por competencia, necesita escanear Traslado con Radicado
  if (trasladoPorCompetencia && currentStatus === 'En respuesta' && nextStatus === 'Traslado por competencia') {
    return 'Traslado con Radicado'
  }

  // Cuando hace respuesta al traslado, necesita escanear Respuesta Traslado
  if (trasladoPorCompetencia && currentStatus === 'Generar respuesta al ciudadano' && nextStatus === 'Radicar respuesta') {
    return 'Respuesta Traslado'
  }

  return null
}

export function getDocumentStatusMessage(documentType: DocumentType | null): string {
  if (!documentType) return ''

  const messages: Record<DocumentType, string> = {
    'Radicado Inicial': '📄 Por favor escanea el radicado inicial antes de continuar',
    'Respuesta Radicada': '📄 Por favor escanea la respuesta radicada antes de continuar',
    'Traslado con Radicado': '📄 Por favor escanea el traslado con radicado antes de continuar',
    'Respuesta Traslado': '📄 Por favor escanea la respuesta del traslado antes de continuar',
  }

  return messages[documentType]
}
