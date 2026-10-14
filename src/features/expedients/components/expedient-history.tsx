import {
  Bot,
  Download,
  FileText,
  History,
  Mail,
  PencilLine,
  Route,
  Search,
  Stamp,
  StickyNote,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useUserLabels, type UserLabel } from '@/hooks/use-user-directory'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatLongDate, formatTime } from '@/lib/format'
import {
  categorizeHistoryAction,
  groupHistoryByDay,
  HISTORY_CATEGORIES,
  matchesHistorySearch,
  splitHistoryChanges,
  type HistoryCategory,
} from '@/lib/history-view'
import { cn } from '@/lib/utils'
import type { ExpedientHistoryEntry } from '@/types/expedient'

const CATEGORY_STYLE: Record<HistoryCategory, { icon: LucideIcon; tone: string }> = {
  tramite: { icon: Route, tone: 'bg-primary/10 text-primary' },
  radicados: { icon: Stamp, tone: 'bg-sky-100 text-sky-700' },
  documentos: { icon: FileText, tone: 'bg-slate-100 text-slate-600' },
  correcciones: { icon: PencilLine, tone: 'bg-violet-100 text-violet-700' },
  comunicaciones: { icon: Mail, tone: 'bg-indigo-100 text-indigo-700' },
  notas: { icon: StickyNote, tone: 'bg-amber-100 text-amber-700' },
}

const categoryLabel = Object.fromEntries(
  HISTORY_CATEGORIES.map((category) => [category.id, category.label]),
) as Record<HistoryCategory, string>

interface ExpedientHistoryProps {
  entries: ExpedientHistoryEntry[]
  /** Radicado de entrada, para el nombre del archivo exportado. */
  filingNumber: string
  /** Si quien consulta puede dejar notas, abre el diálogo. */
  onAddNote?: () => void
}

interface Row {
  entry: ExpedientHistoryEntry
  category: HistoryCategory
  user: UserLabel
}

/**
 * Historial de solo lectura: quién hizo qué y cuándo. Se filtra por tipo de registro, se busca
 * por texto, se agrupa por día, se ordena en los dos sentidos y se exporta a Excel.
 */
export function ExpedientHistory({ entries, filingNumber, onAddNote }: ExpedientHistoryProps) {
  const labelOf = useUserLabels()
  const [category, setCategory] = useState<HistoryCategory | ''>('')
  const [search, setSearch] = useState('')
  const [oldestFirst, setOldestFirst] = useState(false)

  const rows = useMemo<Row[]>(
    () =>
      entries.map((entry) => ({
        entry,
        category: categorizeHistoryAction(entry.accion),
        user: labelOf(entry.usuario),
      })),
    [entries, labelOf],
  )
  const counts = useMemo(() => {
    const result = {} as Record<HistoryCategory, number>
    for (const row of rows) result[row.category] = (result[row.category] ?? 0) + 1
    return result
  }, [rows])
  const visible = useMemo(() => {
    const filtered = rows.filter(
      (row) =>
        (!category || row.category === category) &&
        matchesHistorySearch(row.entry, search, row.user.name),
    )
    return oldestFirst ? [...filtered].reverse() : filtered
  }, [rows, category, search, oldestFirst])
  const groups = groupHistoryByDay(visible.map((row) => ({ ...row, fecha: row.entry.fecha })))
  const filtering = Boolean(category || search.trim())

  const exportRows = () =>
    downloadCsv(
      `historial-${filingNumber}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Fecha', 'Hora', 'Tipo', 'Acción', 'Usuario', 'Rol', 'Detalle'],
      visible.map(({ entry, category: type, user }) => [
        formatDate(entry.fecha, ''),
        formatTime(entry.fecha, ''),
        categoryLabel[type],
        entry.accion,
        user.name,
        user.role ?? '',
        entry.detalle,
      ]),
    )

  return (
    <div className="space-y-3">
      <div className="no-print space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar en el historial: radicado, persona, texto…"
              className="pl-9"
              aria-label="Buscar en el historial"
            />
          </div>
          <Select
            value={oldestFirst ? 'antiguos' : 'recientes'}
            onChange={(event) => setOldestFirst(event.target.value === 'antiguos')}
            className="w-auto"
            aria-label="Orden del historial"
          >
            <option value="recientes">Más recientes primero</option>
            <option value="antiguos">Más antiguos primero</option>
          </Select>
          <Button variant="outline" onClick={exportRows} disabled={!visible.length}>
            <Download size={16} /> Exportar a Excel
          </Button>
          {onAddNote && (
            <Button onClick={onAddNote}>
              <StickyNote size={16} /> Agregar nota
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de registro">
          {[
            { id: '' as const, label: 'Todo', count: rows.length },
            ...HISTORY_CATEGORIES.map((item) => ({ ...item, count: counts[item.id] ?? 0 })),
          ].map((item) => (
            <button
              key={item.id || 'todo'}
              type="button"
              aria-pressed={category === item.id}
              disabled={!item.count && category !== item.id}
              onClick={() => setCategory(item.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
                category === item.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-slate-700 hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              {item.label} <span className="tabular-nums opacity-70">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {!visible.length ? (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <EmptyState
            icon={filtering ? Search : History}
            title={filtering ? 'Ningún registro coincide' : 'Sin registros todavía'}
            action={
              filtering && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCategory('')
                    setSearch('')
                  }}
                >
                  <X size={16} /> Quitar filtros
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {groups.map((group) => (
            <section key={group.day || 'guardando'}>
              <h3 className="border-b border-border bg-muted/50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.day ? formatLongDate(group.day) : 'Guardando…'}
              </h3>
              <ol className="divide-y divide-border/70">
                {group.entries.map((row) => (
                  <HistoryItem key={row.entry.id} {...row} />
                ))}
              </ol>
            </section>
          ))}
          <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
            {filtering
              ? `${visible.length} de ${rows.length} registros`
              : `${rows.length} registros`}
          </p>
        </div>
      )}
    </div>
  )
}

function HistoryItem({ entry, category, user }: Row) {
  const style = CATEGORY_STYLE[category]
  const Icon = user.system ? Bot : style.icon
  const changes = category === 'correcciones' ? splitHistoryChanges(entry.detalle) : []
  const detailed = changes.some((change) => change.label)
  // Un correo o una pregunta que no salió se destaca: alguien tiene que avisar por otro medio.
  const failed = /no enviad/i.test(entry.accion)

  return (
    <li className="flex gap-4 px-5 py-4">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          failed
            ? 'bg-red-100 text-red-700'
            : user.system
              ? 'bg-slate-100 text-slate-500'
              : style.tone,
        )}
        title={categoryLabel[category]}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={cn('font-semibold', failed ? 'text-red-700' : 'text-slate-900')}>
            {entry.accion}
          </p>
          <time className="text-xs tabular-nums text-muted-foreground">
            {formatTime(entry.fecha, 'Guardando…')}
          </time>
        </div>
        <p className="text-xs text-muted-foreground">
          {user.name}
          {user.role && ` · ${user.role}`} · {categoryLabel[category]}
        </p>
        {detailed ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {changes.map((change) => (
              <li key={change.text}>
                {change.label ? (
                  <>
                    <span className="font-medium text-slate-900">{change.label}:</span>{' '}
                    <span className="text-muted-foreground line-through decoration-slate-300">
                      {change.before}
                    </span>{' '}
                    → <span className="font-medium">{change.after}</span>
                  </>
                ) : (
                  change.text
                )}
              </li>
            ))}
          </ul>
        ) : (
          entry.detalle && (
            <p
              className={cn(
                'mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700',
                category === 'notas' && 'rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200',
              )}
            >
              {entry.detalle}
            </p>
          )
        )}
      </div>
    </li>
  )
}
