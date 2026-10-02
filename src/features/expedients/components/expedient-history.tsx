import type { ExpedientHistoryEntry } from '@/types/expedient'

export function ExpedientHistory({ entries }: { entries: ExpedientHistoryEntry[] }) {
  if (!entries.length) return <p className="text-sm text-slate-600">Sin registros todavía.</p>
  return (
    <>
      {entries.map((entry) => (
        <article key={entry.id} className="mb-4 border-l-2 border-primary/30 pl-4">
          <b className="text-sm">{entry.accion}</b>
          <p className="text-sm">{entry.detalle}</p>
          <small>{entry.fecha?.toDate().toLocaleString('es-CO')}</small>
        </article>
      ))}
    </>
  )
}
