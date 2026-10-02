import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  FilePlus2,
  FolderOpen,
  Hourglass,
  Inbox,
  UserX,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button-variants'
import { EmptyState } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ExpedientTable } from '@/features/expedients/components/expedient-table'
import {
  byUrgency,
  matchesDeadlineFocus,
  matchesExpedientSearch,
  type DeadlineFocus,
} from '@/features/expedients/expedient-filters'
import { useAuth } from '@/hooks/use-auth'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useBusinessConfiguration } from '@/hooks/use-business-configuration'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import { useWorkTray } from '@/hooks/use-work-tray'
import { getColombianHolidays } from '@/lib/colombian-holidays'
import { isBusinessDay, toDateKey } from '@/lib/expedient-deadline'
import { formatLongDate } from '@/lib/format'
import { isSupervisor } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { EXPEDIENT_PRIORITIES, EXPEDIENT_STATUSES } from '@/types/expedient'

function greeting(date: Date): string {
  const hour = date.getHours()
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function nextHoliday(today: Date) {
  const key = toDateKey(today)
  return [
    ...getColombianHolidays(today.getFullYear()),
    ...getColombianHolidays(today.getFullYear() + 1),
  ].find((holiday) => holiday.date > key)
}

interface Metric {
  focus: DeadlineFocus
  label: string
  value: number
  hint: string
  icon: LucideIcon
  tone: string
}

export function DashboardPage() {
  const { user, profile, hasRole } = useAuth()
  const { data = [], isLoading, isError } = useWorkTray(profile?.rol, user?.uid)
  const { data: officials = [] } = useAssignableOfficials()
  const { data: procedureTypes = [] } = useProcedureTypes()
  const { data: configuration } = useBusinessConfiguration()
  const [focus, setFocus] = useState<DeadlineFocus>('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [official, setOfficial] = useState('')
  const [type, setType] = useState('')
  const [priority, setPriority] = useState('')
  const supervisor = isSupervisor(profile)
  const canCreate = hasRole(['Administrador', 'Coordinador', 'Funcionario'])

  const today = new Date()
  const extraHolidays = new Set(configuration?.diasFestivos ?? [])
  const workingToday = isBusinessDay(today, extraHolidays)
  const holiday = nextHoliday(today)

  const filtered = useMemo(
    () =>
      data
        .filter(
          (item) =>
            matchesExpedientSearch(item, search) &&
            (!status || item.estado === status) &&
            (!official || item.funcionarioAsignado?.uid === official) &&
            (!type || item.tipoTramiteId === type) &&
            (!priority || item.prioridad === priority),
        )
        .sort(byUrgency),
    [data, official, priority, search, status, type],
  )
  const rows = useMemo(
    () => filtered.filter((item) => matchesDeadlineFocus(item, focus)),
    [filtered, focus],
  )

  const count = (value: DeadlineFocus) =>
    filtered.filter((item) => matchesDeadlineFocus(item, value)).length
  const metrics: Metric[] = [
    {
      focus: 'Vencido',
      label: 'Vencidos',
      value: count('Vencido'),
      hint: 'Requieren respuesta inmediata',
      icon: AlertTriangle,
      tone: 'text-red-600 bg-red-50 ring-red-200',
    },
    {
      focus: 'Próximo a vencer',
      label: 'Próximos a vencer',
      value: count('Próximo a vencer'),
      hint: `Vencen en ${configuration?.umbralProximoVencer ?? 3} días hábiles o menos`,
      icon: CalendarClock,
      tone: 'text-amber-600 bg-amber-50 ring-amber-200',
    },
    {
      focus: 'Sin asignar',
      label: 'Sin responsable',
      value: count('Sin asignar'),
      hint: 'Pendientes de asignación',
      icon: UserX,
      tone: 'text-sky-700 bg-sky-50 ring-sky-200',
    },
    {
      focus: 'Ampliados',
      label: 'Con plazo ampliado',
      value: count('Ampliados'),
      hint: 'Ampliación comunicada al peticionario',
      icon: Hourglass,
      tone: 'text-violet-700 bg-violet-50 ring-violet-200',
    },
  ]

  const hasFilters = Boolean(search || status || official || type || priority || focus)
  const clearFilters = () => {
    setFocus('')
    setSearch('')
    setStatus('')
    setOfficial('')
    setType('')
    setPriority('')
  }
  const firstName = profile?.nombreCompleto.split(' ')[0] ?? ''

  return (
    <section className="mx-auto max-w-[1400px] space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-sidebar px-6 py-6 text-white shadow-lg sm:px-8">
        <div className="flag-stripe absolute inset-x-0 bottom-0 h-1" aria-hidden="true" />
        <div
          className="absolute -right-16 -top-24 size-72 rounded-full bg-primary/50 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-white/60">{formatLongDate(today)}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting(today)}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {profile?.rol === 'Funcionario'
                ? `Tienes ${data.length} expediente${data.length === 1 ? '' : 's'} activo${data.length === 1 ? '' : 's'} a tu cargo.`
                : `${data.length} expediente${data.length === 1 ? '' : 's'} activo${data.length === 1 ? '' : 's'} en la dependencia.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/60">
                <CalendarDays size={14} /> Hoy
              </p>
              <p className="mt-1 text-sm font-semibold">
                {workingToday ? 'Día hábil · corren términos' : 'Día no hábil · no corren términos'}
              </p>
            </div>
            {holiday && (
              <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                <p className="text-xs font-medium uppercase tracking-wide text-white/60">
                  Próximo festivo
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {holiday.name}{' '}
                  <span className="font-normal text-brand-juventud">
                    · {formatLongDate(holiday.date).replace(/ de \d{4}$/, '')}
                  </span>
                </p>
              </div>
            )}
            {canCreate && (
              <Link
                to="/expedientes?nuevo=1"
                className={cn(
                  buttonVariants({ variant: 'accent' }),
                  'h-11 px-5 lg:h-auto lg:self-stretch',
                )}
              >
                <FilePlus2 size={18} /> Radicar expediente
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const active = focus === metric.focus
          return (
            <button
              key={metric.label}
              type="button"
              onClick={() => setFocus(active ? '' : metric.focus)}
              aria-pressed={active}
              className={cn(
                'group flex min-w-0 items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                active ? 'border-primary ring-2 ring-primary/20' : 'border-border',
              )}
            >
              <span
                className={cn(
                  'grid size-12 shrink-0 place-items-center rounded-xl ring-1',
                  metric.tone,
                )}
              >
                <metric.icon size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-muted-foreground">{metric.label}</span>
                <span className="block text-2xl font-bold tabular-nums text-slate-900">
                  {isLoading ? '–' : metric.value}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{metric.hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm lg:flex-row">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filtrar por radicado, solicitante, documento o predio"
            className="lg:max-w-sm"
            aria-label="Filtrar expedientes"
          />
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Estado"
            >
              <option value="">Todos los estados</option>
              {EXPEDIENT_STATUSES.slice(0, -2).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            {supervisor ? (
              <Select
                value={official}
                onChange={(event) => setOfficial(event.target.value)}
                aria-label="Responsable"
              >
                <option value="">Todos los responsables</option>
                {officials.map((value) => (
                  <option key={value.uid} value={value.uid}>
                    {value.nombreCompleto}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                aria-label="Prioridad"
              >
                <option value="">Toda prioridad</option>
                {EXPEDIENT_PRIORITIES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
            )}
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Tipo de trámite"
            >
              <option value="">Todos los trámites</option>
              {procedureTypes.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.nombre}
                </option>
              ))}
            </Select>
            {supervisor && (
              <Select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                aria-label="Prioridad"
              >
                <option value="">Toda prioridad</option>
                {EXPEDIENT_PRIORITIES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
            )}
          </div>
        </div>
        {hasFilters && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {rows.length} de {data.length} expedientes
              {focus && (
                <>
                  {' '}
                  ·{' '}
                  <b className="text-slate-700">{metrics.find((m) => m.focus === focus)?.label}</b>
                </>
              )}
            </span>
            <button
              type="button"
              className="link inline-flex items-center gap-1"
              onClick={clearFilters}
            >
              <X size={14} /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <ExpedientTable
        key={`${focus}|${search}|${status}|${official}|${type}|${priority}`}
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        empty={
          hasFilters ? (
            <EmptyState
              icon={FolderOpen}
              title="Nada coincide con los filtros"
              description="Prueba con otro criterio o limpia los filtros."
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Bandeja al día"
              description="No hay expedientes activos pendientes. ¡Buen trabajo!"
            />
          )
        }
      />
    </section>
  )
}
