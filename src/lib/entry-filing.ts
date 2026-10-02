/**
 * El radicado de entrada identifica el expediente; las respuestas, traslados y ampliaciones
 * se radican aparte y nunca lo reemplazan. Esta lógica detecta cuando se reemplazó por error.
 */

interface DocumentLike {
  tipo: string
  nombre: string
  radicadoNumero?: string
}

interface ExpedientLike {
  numeroRadicado: string
  numeroRadicadoActuacion?: string
  documentosWorkflow?: DocumentLike[]
  ampliacionesPlazo?: { numeroRadicado: string }[]
}

const looksLikeFilingNumber = (value: string) => /^[\w-]*\d[\w-]*$/.test(value.trim())

/** Radicados de salida, traslado y ampliación registrados en el expediente. */
export function getOutgoingFilingNumbers(expedient: Omit<ExpedientLike, 'numeroRadicado'>) {
  const numbers = new Set<string>()
  const add = (value?: string) => value?.trim() && numbers.add(value.trim())
  add(expedient.numeroRadicadoActuacion)
  for (const extension of expedient.ampliacionesPlazo ?? []) add(extension.numeroRadicado)
  for (const document of expedient.documentosWorkflow ?? []) {
    if (document.tipo === 'RECIBIDO') continue
    add(document.radicadoNumero)
    if (looksLikeFilingNumber(document.nombre)) add(document.nombre)
  }
  return numbers
}

/** True si el radicado de entrada coincide con uno de salida, traslado o ampliación. */
export function hasReplacedEntryFiling(expedient: ExpedientLike): boolean {
  return getOutgoingFilingNumbers(expedient).has(expedient.numeroRadicado.trim())
}

/** Número del documento recibido, si parece un radicado; sirve para sugerir la corrección. */
export function suggestEntryFiling(expedient: ExpedientLike): string | undefined {
  const outgoing = getOutgoingFilingNumbers(expedient)
  for (const document of expedient.documentosWorkflow ?? []) {
    if (document.tipo !== 'RECIBIDO') continue
    const candidate = document.radicadoNumero?.trim() || document.nombre.trim()
    if (looksLikeFilingNumber(candidate) && !outgoing.has(candidate)) return candidate
  }
  return undefined
}
