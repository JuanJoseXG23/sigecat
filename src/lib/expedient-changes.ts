import type { Applicant, Property } from '@/types/expedient'

/** Datos editables de un expediente, como texto, para comparar antes y después de editarlo. */
export interface EditableSnapshot {
  area: string
  correspondencia: string
  numeroRadicado: string
  /** yyyy-mm-dd */
  fechaRadicado: string
  fechaRecibido?: string
  medioIngreso?: string
  tipoTramite?: string
  asunto?: string
  responsable?: string
  prioridad?: string
  solicitantes: Applicant[]
  predios: Property[]
  observaciones?: string
}

const describeApplicants = (items: Applicant[]) =>
  items
    .map((item) => [item.nombre, item.documento].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('; ')

const describeProperties = (items: Property[]) =>
  items
    .map((item) => [item.numeroPredial, item.matriculaInmobiliaria].filter(Boolean).join(' / '))
    .filter(Boolean)
    .join('; ')

const sameList = <T extends object>(first: T[], second: T[]) =>
  JSON.stringify(
    first.map((item) =>
      Object.entries(item)
        .filter(([, value]) => value)
        .sort(),
    ),
  ) ===
  JSON.stringify(
    second.map((item) =>
      Object.entries(item)
        .filter(([, value]) => value)
        .sort(),
    ),
  )

/**
 * Qué cambió al editar, para el historial: "Radicado de entrada: A → B". Los textos largos o
 * personales (asunto, observaciones, contacto) solo se nombran, sin copiar su contenido.
 */
export function describeExpedientChanges(
  before: EditableSnapshot,
  after: EditableSnapshot,
): string[] {
  const value = (text?: string) => text?.trim() || 'Sin dato'
  const changes: string[] = []
  const compare = (label: string, previous?: string, next?: string) => {
    if ((previous?.trim() ?? '') !== (next?.trim() ?? ''))
      changes.push(`${label}: ${value(previous)} → ${value(next)}`)
  }
  compare('Área', before.area, after.area)
  compare('Correspondencia', before.correspondencia, after.correspondencia)
  compare('Radicado de entrada', before.numeroRadicado, after.numeroRadicado)
  compare('Fecha de radicado', before.fechaRadicado, after.fechaRadicado)
  compare('Fecha de recibido', before.fechaRecibido, after.fechaRecibido)
  compare('Medio de ingreso', before.medioIngreso, after.medioIngreso)
  compare('Tipo de trámite', before.tipoTramite, after.tipoTramite)
  compare('Responsable', before.responsable, after.responsable)
  compare('Prioridad', before.prioridad, after.prioridad)
  if ((before.asunto?.trim() ?? '') !== (after.asunto?.trim() ?? ''))
    changes.push('Asunto actualizado')
  if (!sameList(before.solicitantes, after.solicitantes)) {
    const previous = describeApplicants(before.solicitantes)
    const next = describeApplicants(after.solicitantes)
    changes.push(
      previous === next
        ? 'Datos de contacto del solicitante actualizados'
        : `Solicitantes: ${value(previous)} → ${value(next)}`,
    )
  }
  if (!sameList(before.predios, after.predios))
    changes.push(
      `Predios: ${value(describeProperties(before.predios))} → ${value(describeProperties(after.predios))}`,
    )
  if ((before.observaciones?.trim() ?? '') !== (after.observaciones?.trim() ?? ''))
    changes.push('Observaciones iniciales actualizadas')
  return changes
}
