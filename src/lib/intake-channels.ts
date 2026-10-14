import { normalizeSearch } from './format'

/** Medios de ingreso sugeridos en el formulario; también se puede escribir otro. */
export const INTAKE_CHANNELS = [
  'Ventanilla única',
  'Presencial',
  'Correo electrónico',
  'Sede electrónica',
  'Correo certificado',
  'Atención telefónica',
]

/**
 * Forma única del medio de ingreso para guardarlo y agruparlo: "CORREO", "Correo" y "correo"
 * cuentan juntos. Si coincide con una opción sugerida se usa su nombre; si no, la primera letra
 * en mayúscula y el resto en minúscula.
 */
export function normalizeIntakeChannel(value?: string): string | undefined {
  const text = value?.trim().replace(/\s+/g, ' ')
  if (!text) return undefined
  const known = INTAKE_CHANNELS.find(
    (channel) => normalizeSearch(channel) === normalizeSearch(text),
  )
  if (known) return known
  const lower = text.toLocaleLowerCase('es-CO')
  return lower.charAt(0).toLocaleUpperCase('es-CO') + lower.slice(1)
}
