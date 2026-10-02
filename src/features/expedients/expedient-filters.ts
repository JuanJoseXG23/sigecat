import { normalizeSearch } from '@/lib/format'
import type { Expedient } from '@/types/expedient'

/** Orden por urgencia: primero lo vencido y lo que vence antes; sin término al final. */
export function byUrgency(first: Expedient, second: Expedient): number {
  const a = first.diasRestantes ?? Number.POSITIVE_INFINITY
  const b = second.diasRestantes ?? Number.POSITIVE_INFINITY
  if (a !== b) return a - b
  return second.fechaRadicado.toMillis() - first.fechaRadicado.toMillis()
}

/**
 * Busca en radicados, solicitantes (nombre y documento), predios (número predial, matrícula,
 * dirección), tipo de trámite y asunto, sin distinguir mayúsculas ni tildes.
 */
export function matchesExpedientSearch(item: Expedient, query: string): boolean {
  const normalized = normalizeSearch(query)
  if (!normalized) return true
  const values = [
    item.numeroRadicado,
    item.numeroRadicadoActuacion,
    item.tipoTramite,
    item.asunto,
    item.funcionarioAsignado?.nombreCompleto,
    ...item.solicitantes.flatMap((applicant) => [applicant.nombre, applicant.documento]),
    ...item.predios.flatMap((property) => [
      property.numeroPredial,
      property.matriculaInmobiliaria,
      property.direccion,
    ]),
    ...(item.ampliacionesPlazo ?? []).map((extension) => extension.numeroRadicado),
  ]
  return values.some((value) => value && normalizeSearch(value).includes(normalized))
}

export type DeadlineFocus = '' | 'Vencido' | 'Próximo a vencer' | 'Sin asignar' | 'Ampliados'

export function matchesDeadlineFocus(item: Expedient, focus: DeadlineFocus): boolean {
  if (!focus) return true
  if (focus === 'Sin asignar') return !item.funcionarioAsignado && !item.responsableExterno
  if (focus === 'Ampliados') return Boolean(item.diasAmpliacion)
  return item.estadoTermino === focus
}
