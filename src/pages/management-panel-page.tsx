import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FolderOpen,
  Mail,
  MessageCircleQuestion,
  RefreshCw,
  Search,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { InquiryDialog } from '@/features/expedients/components/inquiry-dialog'
import { ExpedientTable } from '@/features/expedients/components/expedient-table'
import { byUrgency, matchesExpedientSearch } from '@/features/expedients/expedient-filters'
import { useAuth } from '@/hooks/use-auth'
import { formatDate, formatDateTime } from '@/lib/format'
import {
  answeredOnTime,
  countAnsweredThisMonth,
  countByStage,
  countByTraffic,
  getMonthlySeries,
  getRecentlyAnswered,
  getTimeliness,
  getWorkload,
  TRAFFIC,
  type Traffic,
} from '@/lib/management-panel'
import { cn } from '@/lib/utils'
import { listExpedients, listHistoricalExpedients } from '@/services/expedient.service'
import { listMyInquiries, type InquiryStatus } from '@/services/inquiry.service'
import { getResponseDate, type Expedient, type ExpedientStatus } from '@/types/expedient'

/** Se vuelve a consultar cada minuto para que el panel se mantenga al día solo. */
const REFRESH_MS = 60_000

// Colores validados (CVD y contraste) con el validador de dataviz; el ámbar va siempre con
// su número visible al lado, porque por sí solo no alcanza contraste 3:1.
const TRAFFIC_COLORS: Record<Traffic, string> = {
  'En plazo': '#059669',
  'Próximo a vencer': '#f59e0b',
  Vencido: '#dc2626',
}
const TRAFFIC_ICONS: Record<Traffic, LucideIcon> = {
  'En plazo': CheckCircle2,
  'Próximo a vencer': CalendarClock,
  Vencido: AlertTriangle,
}
const SERIES = {
  received: { label: 'Radicados', color: '#0988CE' },
  answered: { label: 'Respondidos', color: '#07892F' },
} as const

const inquiryVariants: Record<InquiryStatus, BadgeVariant> = {
  Pendiente: 'warning',
  Enviado: 'success',
  Error: 'destructive',
  Omitido: 'default',
}
const inquiryLabels: Record<InquiryStatus, string> = {
  Pendiente: 'En cola',
  Enviado: 'Enviada',
  Error: 'No se envió',
  Omitido: 'Responsable cambió',
}

const monthLabel = new Intl.DateTimeFormat('es-CO', { month: 'short' })
const monthName = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const toMonthDate = (key: string) => new Date(`${key}-01T00:00:00`)

type Filter =
  | { kind: 'traffic'; value: Traffic }
  | { kind: 'stage'; value: ExpedientStatus }
  | { kind: 'person'; uid: string; name: string }
  | null

function describeFilter(filter: Filter): string {
  if (!filter) return ''
  if (filter.kind === 'traffic') return filter.value
  if (filter.kind === 'stage') return `Paso: ${filter.value}`
  return `Responsable: ${filter.name}`
}

function matchesFilter(item: Expedient, filter: Filter): boolean {
  if (!filter) return true
  if (filter.kind === 'traffic') return item.estadoTermino === filter.value
  if (filter.kind === 'stage') return item.estado === filter.value
  return (item.funcionarioAsignado?.uid ?? '') === filter.uid
}

function greeting(date: Date): string {
  const hour = date.getHours()
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function Card({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-5 shadow-sm', className)}>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Globo que aparece al pasar el mouse o enfocar una marca de la gráfica. */
function Tip({ children }: { children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block"
    >
      {children}
    </span>
  )
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon: LucideIcon
  tone: string
  active?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className={cn('grid size-8 place-items-center rounded-lg ring-1', tone)}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </span>
      <span className="mt-2 block text-3xl font-semibold tabular-nums text-slate-900">{value}</span>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </>
  )
  const base = 'rounded-xl border bg-card p-4 text-left shadow-sm transition'
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        base,
        active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40',
      )}
    >
      {content}
    </button>
  ) : (
    <div className={cn(base, 'border-border')}>{content}</div>
  )
}

/** Barra apilada del semáforo, con espacio de 2 px entre segmentos y extremos redondeados. */
function TrafficBar({
  counts,
  height = 'h-6',
}: {
  counts: Record<Traffic, number>
  height?: string
}) {
  const total = TRAFFIC.reduce((sum, key) => sum + counts[key], 0)
  if (!total) return <div className={cn('rounded bg-muted', height)} />
  return (
    <div className={cn('flex gap-0.5 overflow-hidden rounded', height)}>
      {TRAFFIC.filter((key) => counts[key] > 0).map((key) => (
        <div
          key={key}
          className="h-full"
          style={{ width: `${(counts[key] * 100) / total}%`, background: TRAFFIC_COLORS[key] }}
        />
      ))}
    </div>
  )
}

export function ManagementPanelPage() {
  const { user, profile } = useAuth()
  const active = useQuery({
    queryKey: ['expedients'],
    queryFn: () => listExpedients(),
    refetchInterval: REFRESH_MS,
  })
  const closed = useQuery({
    queryKey: ['historical-expedients'],
    queryFn: listHistoricalExpedients,
    refetchInterval: REFRESH_MS,
  })
  const inquiries = useQuery({
    queryKey: ['inquiries', user?.uid],
    queryFn: () => listMyInquiries(user!.uid),
    enabled: Boolean(user),
    refetchInterval: REFRESH_MS,
  })
  const [filter, setFilter] = useState<Filter>(null)
  const [search, setSearch] = useState('')
  const [asking, setAsking] = useState<Expedient | null>(null)
  const [showData, setShowData] = useState(false)

  const activeItems = useMemo(() => active.data ?? [], [active.data])
  const closedItems = useMemo(() => closed.data ?? [], [closed.data])
  const today = new Date()
  const traffic = countByTraffic(activeItems)
  const stages = countByStage(activeItems)
  const workload = getWorkload(activeItems)
  const series = getMonthlySeries([...activeItems, ...closedItems], 6, today)
  const yearTimeliness = getTimeliness(
    closedItems.filter((item) => getResponseDate(item).getFullYear() === today.getFullYear()),
  )
  const recent = getRecentlyAnswered(closedItems, 8)
  const rows = useMemo(
    () =>
      activeItems
        .filter((item) => matchesFilter(item, filter) && matchesExpedientSearch(item, search))
        .sort(byUrgency),
    [activeItems, filter, search],
  )
  const loading = active.isLoading || closed.isLoading
  const updatedAt = Math.max(active.dataUpdatedAt, closed.dataUpdatedAt)
  const maxStage = Math.max(1, ...stages.map(([, count]) => count))
  const maxMonth = Math.max(1, ...series.flatMap((point) => [point.received, point.answered]))
  const firstName = profile?.nombreCompleto.split(' ')[0]

  const toggle = (next: NonNullable<Filter>) => {
    setFilter(JSON.stringify(filter) === JSON.stringify(next) ? null : next)
    document.getElementById('expedientes-en-tramite')?.scrollIntoView({ behavior: 'smooth' })
  }
  const isActive = (next: NonNullable<Filter>) => JSON.stringify(filter) === JSON.stringify(next)

  return (
    <section className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Panel de dirección · Derechos de petición
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
            {greeting(today)}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Cómo van los trámites hoy: qué está vencido, quién lo tiene y qué se respondió. Toca
            cualquier gráfica para ver esos expedientes abajo.
          </p>
        </div>
        <div className="no-print flex items-center gap-3 text-xs text-muted-foreground">
          {updatedAt > 0 && <span>Actualizado {formatDateTime(new Date(updatedAt))}</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void active.refetch()
              void closed.refetch()
              void inquiries.refetch()
            }}
            disabled={active.isFetching || closed.isFetching}
          >
            <RefreshCw size={15} className={cn(active.isFetching && 'animate-spin')} /> Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))
        ) : (
          <>
            <StatTile
              label="En trámite"
              value={activeItems.length}
              hint="Peticiones activas hoy"
              icon={FolderOpen}
              tone="bg-primary/10 text-primary ring-primary/20"
              active={!filter}
              onClick={() => setFilter(null)}
            />
            <StatTile
              label="Vencidos"
              value={traffic.Vencido}
              hint="Pasaron su fecha límite"
              icon={AlertTriangle}
              tone="bg-red-50 text-red-600 ring-red-200"
              active={isActive({ kind: 'traffic', value: 'Vencido' })}
              onClick={() => toggle({ kind: 'traffic', value: 'Vencido' })}
            />
            <StatTile
              label="Próximos a vencer"
              value={traffic['Próximo a vencer']}
              hint="Vencen en pocos días hábiles"
              icon={CalendarClock}
              tone="bg-amber-50 text-amber-600 ring-amber-200"
              active={isActive({ kind: 'traffic', value: 'Próximo a vencer' })}
              onClick={() => toggle({ kind: 'traffic', value: 'Próximo a vencer' })}
            />
            <StatTile
              label="Respondidos este mes"
              value={countAnsweredThisMonth(closedItems, today)}
              hint={monthName.format(today)}
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-700 ring-emerald-200"
            />
            <StatTile
              label="Respuesta oportuna"
              value={yearTimeliness.rate === null ? '—' : `${yearTimeliness.rate}%`}
              hint={
                yearTimeliness.rate === null
                  ? `Sin respuestas en ${today.getFullYear()}`
                  : `${yearTimeliness.onTime} de ${yearTimeliness.onTime + yearTimeliness.late} a tiempo en ${today.getFullYear()}`
              }
              icon={Timer}
              tone="bg-sky-50 text-sky-700 ring-sky-200"
            />
          </>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Semáforo de términos"
          description={`${activeItems.length} expedientes en trámite según su fecha límite.`}
        >
          <TrafficBar counts={traffic} height="h-8" />
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {TRAFFIC.map((key) => {
              const Icon = TRAFFIC_ICONS[key]
              const share = activeItems.length
                ? Math.round((traffic[key] * 100) / activeItems.length)
                : 0
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggle({ kind: 'traffic', value: key })}
                    aria-pressed={isActive({ kind: 'traffic', value: key })}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition',
                      isActive({ kind: 'traffic', value: key })
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40',
                    )}
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full text-white"
                      style={{ background: TRAFFIC_COLORS[key] }}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xl font-semibold tabular-nums text-slate-900">
                        {traffic[key]}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {share}%
                        </span>
                      </span>
                      <span className="block truncate text-xs text-slate-600">{key}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card title="¿En qué paso están?" description="Expedientes en trámite por paso del flujo.">
          {stages.length ? (
            <ul className="space-y-2">
              {stages.map(([stage, count]) => (
                <li key={stage}>
                  <button
                    type="button"
                    onClick={() => toggle({ kind: 'stage', value: stage })}
                    aria-pressed={isActive({ kind: 'stage', value: stage })}
                    className={cn(
                      'group relative grid w-full grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition',
                      isActive({ kind: 'stage', value: stage })
                        ? 'bg-primary/5'
                        : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="truncate text-slate-700">{stage}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-5 rounded-r bg-primary"
                        style={{ width: `${Math.max(2, (count * 100) / maxStage)}%` }}
                      />
                      <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                        {count}
                      </span>
                    </span>
                    <Tip>
                      {stage}: {count} expediente{count === 1 ? '' : 's'}
                    </Tip>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No hay expedientes en trámite.</p>
          )}
        </Card>

        <Card
          title="Radicados y respondidos por mes"
          description="Últimos seis meses. Respondidos según la fecha real del radicado de respuesta."
        >
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            {Object.values(SERIES).map((entry) => (
              <span key={entry.label} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: entry.color }} />
                {entry.label}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setShowData(!showData)}
              className="link ml-auto"
              aria-expanded={showData}
            >
              {showData ? 'Ver gráfica' : 'Ver datos'}
            </button>
          </div>
          {showData ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Mes</th>
                  <th className="py-1 text-right font-medium">Radicados</th>
                  <th className="py-1 text-right font-medium">Respondidos</th>
                  <th className="py-1 text-right font-medium">A tiempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {series.map((point) => (
                  <tr key={point.month}>
                    <td className="py-1.5 capitalize">
                      {monthName.format(toMonthDate(point.month))}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{point.received}</td>
                    <td className="py-1.5 text-right tabular-nums">{point.answered}</td>
                    <td className="py-1.5 text-right tabular-nums">{point.answeredOnTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex h-48 items-end gap-3 border-b border-border">
              {series.map((point) => (
                <div
                  key={point.month}
                  tabIndex={0}
                  className="group relative flex h-full flex-1 flex-col justify-end outline-none"
                >
                  <div className="flex h-full items-end justify-center gap-0.5">
                    {(['received', 'answered'] as const).map((key) => (
                      <div key={key} className="flex h-full w-full max-w-6 flex-col justify-end">
                        <span className="mb-1 text-center text-[0.7rem] font-medium tabular-nums text-slate-600">
                          {point[key] || ''}
                        </span>
                        <div
                          className="rounded-t"
                          style={{
                            height: `${(point[key] * 100) / maxMonth}%`,
                            minHeight: point[key] ? 2 : 0,
                            background: SERIES[key].color,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <Tip>
                    <span className="capitalize">{monthName.format(toMonthDate(point.month))}</span>
                    : {point.received} radicados · {point.answered} respondidos (
                    {point.answeredOnTime} a tiempo)
                  </Tip>
                </div>
              ))}
            </div>
          )}
          {!showData && (
            <div className="mt-1.5 flex gap-3">
              {series.map((point) => (
                <span
                  key={point.month}
                  className="flex-1 text-center text-xs capitalize text-muted-foreground"
                >
                  {monthLabel.format(toMonthDate(point.month)).replace('.', '')}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Carga por responsable"
          description="Expedientes en trámite de cada persona; primero quien tiene más vencidos."
        >
          {workload.length ? (
            <ul className="space-y-2">
              {workload.map((entry) => {
                const next = { kind: 'person', uid: entry.uid, name: entry.name } as const
                return (
                  <li key={entry.uid || 'none'}>
                    <button
                      type="button"
                      onClick={() => toggle(next)}
                      aria-pressed={isActive(next)}
                      className={cn(
                        'group relative grid w-full grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition',
                        isActive(next) ? 'bg-primary/5' : 'hover:bg-muted/60',
                      )}
                    >
                      <span
                        className={cn(
                          'truncate',
                          entry.uid ? 'text-slate-700' : 'font-medium text-amber-700',
                        )}
                      >
                        {entry.name}
                      </span>
                      <TrafficBar counts={entry.traffic} height="h-4" />
                      <span className="text-right font-semibold tabular-nums text-slate-900">
                        {entry.total}
                      </span>
                      <Tip>
                        {entry.name}: {entry.traffic['En plazo']} en plazo ·{' '}
                        {entry.traffic['Próximo a vencer']} próximos · {entry.traffic.Vencido}{' '}
                        vencidos
                      </Tip>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No hay expedientes en trámite.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            {TRAFFIC.map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: TRAFFIC_COLORS[key] }} />
                {key}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <section id="expedientes-en-tramite" className="scroll-mt-20 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Expedientes en trámite</h2>
            <p className="text-sm text-muted-foreground">
              Del más urgente al menos urgente. Usa <b>Preguntar</b> para escribirle al responsable.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {filter && (
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
              >
                {describeFilter(filter)} <X size={14} aria-label="Quitar filtro" />
              </button>
            )}
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Radicado, solicitante o responsable"
                aria-label="Buscar expedientes"
              />
            </div>
          </div>
        </div>
        <ExpedientTable
          rows={rows}
          isLoading={active.isLoading}
          isError={active.isError}
          empty={
            <EmptyState
              icon={CheckCircle2}
              title={filter || search ? 'Nada con ese filtro' : 'No hay expedientes en trámite'}
              description={filter || search ? 'Quita el filtro para ver todos.' : undefined}
            />
          }
          actions={(item) => (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAsking(item)}
              disabled={!item.funcionarioAsignado}
              title={
                item.funcionarioAsignado
                  ? `Preguntar a ${item.funcionarioAsignado.nombreCompleto}`
                  : 'Sin responsable asignado'
              }
            >
              <MessageCircleQuestion size={15} /> Preguntar
            </Button>
          )}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Respondidos recientemente" description="Con la fecha real de la respuesta.">
          {recent.length ? (
            <ul className="divide-y divide-border">
              {recent.map((item) => {
                const onTime = answeredOnTime(item)
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <Link to={`/expedientes/${item.id}`} className="link font-semibold">
                        {item.numeroRadicado}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.funcionarioAsignado?.nombreCompleto ?? 'Sin responsable'} ·{' '}
                        {formatDate(getResponseDate(item))}
                      </span>
                    </span>
                    {onTime !== null && (
                      <Badge variant={onTime ? 'success' : 'destructive'} dot>
                        {onTime ? 'A tiempo' : 'Fuera de término'}
                      </Badge>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay respuestas registradas.</p>
          )}
        </Card>

        <Card title="Mis preguntas" description="Lo que has preguntado a los responsables.">
          {inquiries.data?.length ? (
            <ul className="divide-y divide-border">
              {inquiries.data.slice(0, 8).map((inquiry) => (
                <li key={inquiry.id} className="space-y-1 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <Link
                        to={`/expedientes/${inquiry.expedienteId}`}
                        className="link font-semibold"
                      >
                        {inquiry.expedienteRadicado}
                      </Link>
                      <span className="text-muted-foreground"> · {inquiry.destinatarioNombre}</span>
                    </span>
                    <Badge variant={inquiryVariants[inquiry.estado]}>
                      {inquiryLabels[inquiry.estado]}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-slate-700">{inquiry.pregunta}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(inquiry.fechaSolicitud, 'Enviando…')}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Mail}
              title="Aún no has hecho preguntas"
              description="Usa el botón Preguntar en un expediente; la respuesta llegará a tu correo."
              className="py-6"
            />
          )}
        </Card>
      </div>

      {asking && <InquiryDialog expedient={asking} onClose={() => setAsking(null)} />}
    </section>
  )
}
