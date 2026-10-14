/**
 * Áreas de la Secretaría de Hacienda y Desarrollo Económico. El id se guarda en Firestore y no
 * cambia nunca; el nombre es el que se muestra. Para agregar un área basta con sumarla aquí.
 */
export const DEPENDENCIES = [
  { id: 'catastro', nombre: 'Catastro' },
  { id: 'cobro-coactivo', nombre: 'Cobro coactivo' },
  { id: 'impuestos', nombre: 'Impuestos' },
  { id: 'fiscalizacion', nombre: 'Fiscalización' },
  { id: 'contabilidad', nombre: 'Contabilidad' },
  { id: 'tesoreria', nombre: 'Tesorería' },
  { id: 'presupuesto', nombre: 'Presupuesto' },
] as const

export type DependencyId = (typeof DEPENDENCIES)[number]['id']

/** Los expedientes anteriores a las dependencias son todos de Catastro. */
export const DEFAULT_DEPENDENCY: DependencyId = 'catastro'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')

/**
 * Id del área a partir de un id o de un nombre escrito a mano ("Catastro", "Tesorería"), como
 * los que tenían los perfiles antes del catálogo; undefined si no corresponde a ninguna.
 */
export function toDependencyId(value?: string): DependencyId | undefined {
  if (!value) return undefined
  const key = normalize(value)
  return DEPENDENCIES.find((item) => item.id === key || normalize(item.nombre) === key)?.id
}

/** Nombre para mostrar; un valor fuera del catálogo se muestra tal cual. */
export function getDependencyName(value?: string): string {
  const id = toDependencyId(value)
  return DEPENDENCIES.find((item) => item.id === id)?.nombre ?? value ?? 'Sin área'
}

/** Si el expediente es del área elegida; sin área elegida, todos coinciden. */
export function matchesDependency(item: { dependencia?: string }, filter: string): boolean {
  return !filter || getExpedientDependency(item) === filter
}

/** Área de un expediente; los que no la tienen son de Catastro. */
export function getExpedientDependency(item: { dependencia?: string }): DependencyId {
  return toDependencyId(item.dependencia) ?? DEFAULT_DEPENDENCY
}
