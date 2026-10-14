/**
 * Reconstruye `participantes` de los expedientes anteriores al campo: quién lo registró, quién
 * lo tiene, quién actuó (el `usuario` del historial ya es un uid) y quiénes lo tuvieron asignado.
 * Estos últimos solo aparecen por nombre en el historial, así que se buscan únicamente en las
 * acciones que registran un cambio de responsable, nunca en textos libres como los motivos.
 */

/** Acciones cuyo detalle nombra a responsables ("Ana Pérez → Luis Gómez"). */
const ASSIGNMENT_ACTIONS = new Set([
  'Asignó responsable',
  'Cambio de responsable',
  'Edición del expediente',
  'Traslado por competencia',
])

export interface PersonLike {
  uid: string
  nombreCompleto: string
}

export interface HistoryLike {
  usuario: string
  accion: string
  detalle: string
}

export interface ExpedientParticipantsSource {
  creadoPor?: string
  funcionarioAsignado?: { uid: string }
  participantes?: string[]
  history: HistoryLike[]
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// Flechas y signos separan nombres: "Ana Pérez → Luis" no contiene a "Pérez Luis".
const toWords = (value: string) =>
  ` ${normalize(value).replace(/[^\p{L}\p{N} ]+/gu, ' | ')} `.replace(/\s+/g, ' ')

/**
 * Uids de las personas nombradas en el texto, como nombre completo y palabras enteras. Los
 * nombres más largos van primero y se retiran al encontrarlos, para que "Ana Pérez Gómez" no
 * cuente también como "Ana Pérez".
 */
export function findNamedPeople(text: string, people: PersonLike[]): string[] {
  let haystack = toWords(text)
  const found: string[] = []
  const byLength = people
    .map((person) => ({ uid: person.uid, name: toWords(person.nombreCompleto) }))
    .filter((person) => person.name.trim() && !person.name.includes('|'))
    .sort((a, b) => b.name.length - a.name.length)
  for (const person of byLength) {
    if (!haystack.includes(person.name)) continue
    found.push(person.uid)
    haystack = haystack.split(person.name).join(' | ')
  }
  return people.filter((person) => found.includes(person.uid)).map((person) => person.uid)
}

/** Participantes del expediente, incluidos los que ya tenía; sin repetidos y en orden. */
export function deriveParticipants(
  source: ExpedientParticipantsSource,
  people: PersonLike[],
): string[] {
  const known = new Set(people.map((person) => person.uid))
  const result = new Set(source.participantes ?? [])
  if (source.creadoPor) result.add(source.creadoPor)
  if (source.funcionarioAsignado?.uid) result.add(source.funcionarioAsignado.uid)
  for (const entry of source.history) {
    if (known.has(entry.usuario)) result.add(entry.usuario)
    if (ASSIGNMENT_ACTIONS.has(entry.accion))
      for (const uid of findNamedPeople(entry.detalle, people)) result.add(uid)
  }
  return [...result]
}
