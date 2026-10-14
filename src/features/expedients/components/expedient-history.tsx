import { History, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { useUserNames } from '@/hooks/use-user-directory'
import { isNote } from '@/lib/expedient-notes'
import { formatDateTime, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExpedientHistoryEntry } from '@/types/expedient'

interface ExpedientHistoryProps {
  entries: ExpedientHistoryEntry[]
  /** Si quien consulta puede dejar notas, abre el diálogo. */
  onAddNote?: () => void
}

/**
 * Historial de solo lectura: quién hizo qué y cuándo, del más reciente al más antiguo. Las
 * notas se destacan y se pueden ver solas.
 */
export function ExpedientHistory({ entries, onAddNote }: ExpedientHistoryProps) {
  const nameOf = useUserNames()
  const [onlyNotes, setOnlyNotes] = useState(false)
  const noteCount = entries.filter(isNote).length
  const visible = onlyNotes ? entries.filter(isNote) : entries

  return (
    <div className="space-y-3">
      {(onAddNote || noteCount > 0) && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm" role="group">
            {[
              { value: false, label: `Todo (${entries.length})` },
              { value: true, label: `Solo notas (${noteCount})` },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={onlyNotes === option.value}
                onClick={() => setOnlyNotes(option.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium transition',
                  onlyNotes === option.value
                    ? 'bg-card text-slate-900 shadow-sm'
                    : 'text-muted-foreground hover:text-slate-900',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {onAddNote && (
            <Button variant="outline" size="sm" onClick={onAddNote}>
              <StickyNote size={15} /> Agregar nota
            </Button>
          )}
        </div>
      )}

      {!visible.length ? (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <EmptyState
            icon={onlyNotes ? StickyNote : History}
            title={onlyNotes ? 'Sin notas todavía' : 'Sin registros todavía'}
          />
        </div>
      ) : (
        <ol className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {visible.map((entry, index) => {
            const name = nameOf(entry.usuario)
            const note = isNote(entry)
            return (
              <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                {index < visible.length - 1 && (
                  <span className="absolute left-[1.05rem] top-10 h-[calc(100%-2.5rem)] w-px bg-border" />
                )}
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold',
                    note ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary',
                  )}
                >
                  {note ? <StickyNote size={16} aria-label="Nota" /> : initials(name)}
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
                    <p
                      className={cn(
                        'mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700',
                        note && 'rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200',
                      )}
                    >
                      {entry.detalle}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
