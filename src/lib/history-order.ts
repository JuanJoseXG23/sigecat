interface HistoryLike {
  fecha: { toMillis(): number } | null
  orden?: number
}

/**
 * Del más reciente al más antiguo. Las entradas guardadas juntas tienen la misma hora; entre
 * ellas manda `orden`, para que "Finalizó expediente" quede después de "Registró radicado".
 * Una entrada recién creada aún sin hora del servidor va primero.
 */
export function sortHistoryNewestFirst<T extends HistoryLike>(entries: T[]): T[] {
  const time = (entry: T) => entry.fecha?.toMillis() ?? Number.POSITIVE_INFINITY
  return [...entries].sort(
    (first, second) => time(second) - time(first) || (second.orden ?? 0) - (first.orden ?? 0),
  )
}
