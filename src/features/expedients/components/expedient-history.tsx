import { History } from 'lucide-react'
import { EmptyState } from '@/components/ui/feedback'
import { useUserNames } from '@/hooks/use-user-directory'
import { formatDateTime, initials } from '@/lib/format'
import type { ExpedientHistoryEntry } from '@/types/expedient'

/** Historial de solo lectura: quién hizo qué y cuándo, del más reciente al más antiguo. */
export function ExpedientHistory({ entries }: { entries: ExpedientHistoryEntry[] }) {
  const nameOf = useUserNames()
  if (!entries.length)
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <EmptyState icon={History} title="Sin registros todavía" />
      </div>
    )
  return (
    <ol className="rounded-xl border border-border bg-card p-5 shadow-sm">
      {entries.map((entry, index) => {
        const name = nameOf(entry.usuario)
        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            {index < entries.length - 1 && (
              <span className="absolute left-[1.05rem] top-10 h-[calc(100%-2.5rem)] w-px bg-border" />
            )}
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {initials(name)}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-semibold text-slate-900">{entry.accion}</p>
                <time className="text-xs text-muted-foreground">
                  {formatDateTime(entry.fecha, 'Guardando…')}
                </time>
              </div>
              <p className="text-xs text-muted-foreground">{name}</p>
              {entry.detalle && (
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {entry.detalle}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
