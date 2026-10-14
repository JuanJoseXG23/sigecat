import { getDependencyName, toDependencyId } from './dependencies'

/**
 * Apoyo en respuesta: cuando parte de una petición la responde otra área, se deja constancia de
 * quién apoyó y en qué. El expediente no cambia de área ni de responsable. Si quien apoyó tiene
 * usuario, queda en `participantes` y puede consultar el expediente, pero no gestionarlo.
 */
export interface ResponseSupportInput {
  dependencia: string
  persona: string
  /** uid de quien apoyó, si tiene usuario en SIGECAT. */
  personaUid?: string
  descripcion: string
}

export const EMPTY_RESPONSE_SUPPORT: ResponseSupportInput = {
  dependencia: '',
  persona: '',
  descripcion: '',
}

export const MAX_SUPPORT_DESCRIPTION = 500

/** Primer dato pendiente o inválido, o null si el apoyo se puede registrar. */
export function getResponseSupportError(input: ResponseSupportInput): string | null {
  if (!toDependencyId(input.dependencia)) return 'Elige el área que apoyó la respuesta.'
  if (input.persona.trim().length < 3) return 'Escribe el nombre de quien apoyó la respuesta.'
  const description = input.descripcion.trim()
  if (description.length < 5) return 'Describe en qué apoyó (al menos 5 caracteres).'
  if (description.length > MAX_SUPPORT_DESCRIPTION)
    return `La descripción admite hasta ${MAX_SUPPORT_DESCRIPTION} caracteres.`
  return null
}

/** Texto del historial: "Ana Pérez (Tesorería): Certificó el estado de cuenta." */
export function describeResponseSupport(input: ResponseSupportInput): string {
  return `${input.persona.trim()} (${getDependencyName(input.dependencia)}): ${input.descripcion.trim()}`
}
