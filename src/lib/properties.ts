import type { Property } from '@/types/expedient'

/**
 * Los predios son opcionales. Antes el formulario guardaba siempre uno con el municipio
 * "Girardota" y nada más; ese predio no identifica nada y no se muestra.
 */
export function hasPropertyData(property: Property): boolean {
  return [property.numeroPredial, property.matriculaInmobiliaria, property.direccion].some(
    (value) => Boolean(value?.trim()),
  )
}

/** Predios con datos reales; tolera expedientes sin el campo. */
export function getRegisteredProperties(properties: Property[] | undefined): Property[] {
  return (properties ?? []).filter(hasPropertyData)
}
