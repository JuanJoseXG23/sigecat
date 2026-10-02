/**
 * Correcciones de radicados ya registrados. Un mismo número aparece en varios lugares del
 * expediente (radicado de la actuación, documentos asociados, ampliaciones de plazo); esta
 * lógica pura decide qué hay que reescribir para que todo quede igual.
 */

export interface FilingCorrection {
  previousNumber: string
  number: string
  date: string
}

interface DocumentLike {
  radicadoNumero?: string
}

interface ExtensionLike {
  numeroRadicado: string
  fechaRadicado: string
}

interface ExpedientLike<D extends DocumentLike, E extends ExtensionLike> {
  numeroRadicadoActuacion?: string
  documentosWorkflow?: D[]
  ampliacionesPlazo?: E[]
}

/** Primer dato inválido de la corrección, o null si se puede guardar. */
export function getFilingCorrectionError(
  correction: FilingCorrection,
  previousDate: string,
  today: string,
): string | null {
  if (!correction.number.trim()) return 'Escribe el número de radicado.'
  if (!correction.date) return 'Selecciona la fecha del radicado.'
  if (correction.date > today) return 'La fecha del radicado no puede ser futura.'
  if (correction.number.trim() === correction.previousNumber && correction.date === previousDate)
    return 'No hay cambios para guardar.'
  return null
}

/**
 * Campos del expediente que cambian con la corrección; vacío si el radicado no aparece en él.
 * `toDocumentDate` convierte la fecha al formato que guardan los documentos.
 */
export function planFilingCorrection<D extends DocumentLike, E extends ExtensionLike, T>(
  expedient: ExpedientLike<D, E>,
  correction: FilingCorrection,
  toDocumentDate: (date: string) => T,
): Record<string, unknown> {
  const number = correction.number.trim()
  const changes: Record<string, unknown> = {}
  if (expedient.numeroRadicadoActuacion === correction.previousNumber) {
    changes.numeroRadicadoActuacion = number
    changes.fechaRadicadoActuacion = correction.date
  }
  const documents = expedient.documentosWorkflow ?? []
  if (documents.some((document) => document.radicadoNumero === correction.previousNumber)) {
    changes.documentosWorkflow = documents.map((document) =>
      document.radicadoNumero === correction.previousNumber
        ? { ...document, radicadoNumero: number, radicadoFecha: toDocumentDate(correction.date) }
        : document,
    )
  }
  const extensions = expedient.ampliacionesPlazo ?? []
  if (extensions.some((extension) => extension.numeroRadicado === correction.previousNumber)) {
    changes.ampliacionesPlazo = extensions.map((extension) =>
      extension.numeroRadicado === correction.previousNumber
        ? { ...extension, numeroRadicado: number, fechaRadicado: correction.date }
        : extension,
    )
  }
  return changes
}
