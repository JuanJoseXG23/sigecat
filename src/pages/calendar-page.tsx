import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BellPlus,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ListTodo,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState, ErrorAlert } from '@/components/ui/feedback'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { ReminderDialog } from '@/features/calendar/reminder-dialog'
import { useAuth } from '@/hooks/use-auth'
import { useTasks } from '@/hooks/use-tasks'
import {
  DEADLINE_TONE_LABELS,
  getDeadlineTone,
  getGridRange,
  getMonthGrid,
  groupByDay,
  type DeadlineTone,
} from '@/lib/calendar'
import { fromDateKey, toDateKey } from '@/lib/expedient-deadline'
import { formatDate, formatLongDate } from '@/lib/format'
import { isSupervisor } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { listDeadlinesInRange } from '@/services/expedient.service'
import {
  deleteReminder,
  listRemindersCreatedBy,
  listRemindersFor,
  setReminderDone,
} from '@/services/reminder.service'
import { listDirectory } from '@/services/user-profile.service'
import type { Expedient } from '@/types/expedient'
import type { Reminder } from '@/types/reminder'
import type { AgendaTask } from '@/types/task'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const monthTitle = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('es-CO') + text.slice(1)

const TONE_CHIP: Record<DeadlineTone, string> = {
  vencido: 'bg-red-50 text-red-800 ring-red-200',
  proximo: 'bg-amber-50 text-amber-800 ring-amber-200',
  'en-plazo': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  respondido: 'bg-sky-50 text-sky-800 ring-sky-200',
  'respondido-tarde': 'bg-slate-100 text-slate-600 ring-slate-300',
}
const TONE_DOT: Record<DeadlineTone, string> = {
  vencido: 'bg-red-500',
  proximo: 'bg-amber-500',
  'en-plazo': 'bg-emerald-500',
  respondido: 'bg-sky-500',
  'respondido-tarde': 'bg-slate-400',
}
const TONE_BADGE: Record<DeadlineTone, BadgeVariant> = {
  vencido: 'destructive',
  proximo: 'warning',
  'en-plazo': 'success',
  respondido: 'info',
  'respondido-tarde': 'default',
}

/** Estado de cada correo en la lista de recordatorios creados. */
const NOTICE_LABEL: Record<Reminder['correo'], string> = {
  Pendiente: 'por enviar',
  Enviado: 'enviado',
  Error: 'no se pudo enviar',
  Omitido: 'no hizo falta',
}
const DAY_LABEL: Record<Reminder['correo'], string> = {
  Pendiente: 'programado',
  Enviado: 'enviado',
  Error: 'no se pudo enviar',
  Omitido: 'sin correo',
}

const EMAIL_LABEL: Record<Reminder['correo'], string> = {
  Pendiente: 'Correo programado',
  Enviado: 'Correo enviado',
  Error: 'El correo no se pudo enviar',
  Omitido: 'Sin correo',
}

interface DayItems {
  deadlines: Expedient[]
  reminders: Reminder[]
  tasks: AgendaTask[]
}

/**
 * Calendario de cada persona: sus vencimientos (fecha límite de los expedientes, con el
 * semáforo; los respondidos en otro color), sus recordatorios y, en el propio, las tareas de Mi
 * agenda con fecha. Administrador y Coordinador ven el de cualquiera y le crean recordatorios.
 */
export function CalendarPage() {
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const supervisor = isSupervisor(profile)
  const today = toDateKey(new Date())
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  const [personUid, setPersonUid] = useState(user!.uid)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Reminder | null>(null)
  const own = personUid === user!.uid

  const grid = getMonthGrid(month.year, month.month)
  const range = getGridRange(month.year, month.month)
  const { data: directory = [] } = useQuery({
    queryKey: ['user-directory'],
    queryFn: listDirectory,
    enabled: supervisor,
  })
  const deadlines = useQuery({
    queryKey: ['calendar-deadlines', personUid, month.year, month.month],
    queryFn: () => listDeadlinesInRange(personUid, range.start, range.end),
  })
  const reminders = useQuery({
    queryKey: ['reminders', personUid, month.year, month.month],
    queryFn: () => listRemindersFor(personUid, grid[0], toDateKey(range.end)),
  })
  const { data: tasks = [] } = useTasks(own ? user!.uid : undefined)
  const sent = useQuery({
    queryKey: ['reminders-sent', user!.uid],
    queryFn: () => listRemindersCreatedBy(user!.uid),
    enabled: supervisor,
  })

  const days = useMemo(() => {
    const byDeadline = groupByDay(deadlines.data ?? [], (item) =>
      toDateKey(item.fechaLimite!.toDate()),
    )
    const byReminder = groupByDay(reminders.data ?? [], (item) => item.fecha)
    const byTask = groupByDay(own ? tasks.filter((task) => task.fechaLimite) : [], (task) =>
      toDateKey(task.fechaLimite!.toDate()),
    )
    return (day: string): DayItems => ({
      deadlines: byDeadline.get(day) ?? [],
      reminders: byReminder.get(day) ?? [],
      tasks: byTask.get(day) ?? [],
    })
  }, [deadlines.data, reminders.data, tasks, own])

  const refreshReminders = async () => {
    await client.invalidateQueries({ queryKey: ['reminders'] })
    await client.invalidateQueries({ queryKey: ['reminders-sent'] })
  }
  const toggleDone = useMutation({
    mutationFn: (reminder: Reminder) => setReminderDone(reminder.id, !reminder.hecho),
    onSuccess: refreshReminders,
  })
  const remove = useMutation({
    mutationFn: (reminder: Reminder) => deleteReminder(reminder.id),
    onSuccess: async () => {
      setDeleting(null)
      await refreshReminders()
    },
  })

  const moveMonth = (step: number) =>
    setMonth(({ year, month: current }) => {
      const date = new Date(year, current + step, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  const goToday = () => {
    const now = new Date()
    setMonth({ year: now.getFullYear(), month: now.getMonth() })
    setSelected(today)
  }
  const selectDay = (day: string) => {
    setSelected(day)
    const date = fromDateKey(day)
    if (date.getMonth() !== month.month)
      setMonth({ year: date.getFullYear(), month: date.getMonth() })
  }
  const personName =
    directory.find((entry) => entry.uid === personUid)?.nombreCompleto ?? profile?.nombreCompleto
  const canDelete = (reminder: Reminder) =>
    reminder.creadoPor === user!.uid || profile?.rol === 'Administrador'
  const selectedItems = days(selected)

  return (
    <section className="mx-auto max-w-[1400px] space-y-5">
      <PageHeader
        kicker="Organización"
        title="Calendario"
        description={
          own
            ? 'Tus vencimientos con el semáforo de términos, tus recordatorios y las tareas de Mi agenda con fecha.'
            : `Vencimientos y recordatorios de ${personName}.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {supervisor && (
              <Select
                value={personUid}
                onChange={(event) => setPersonUid(event.target.value)}
                className="w-auto min-w-64"
                aria-label="Calendario de"
              >
                {directory
                  .filter((entry) => entry.activo)
                  .map((entry) => (
                    <option key={entry.uid} value={entry.uid}>
                      {entry.uid === user!.uid ? 'Mi calendario' : entry.nombreCompleto}
                    </option>
                  ))}
              </Select>
            )}
            <Button onClick={() => setCreating(true)}>
              <BellPlus size={17} /> Nuevo recordatorio
            </Button>
          </div>
        }
      />

      <ErrorAlert
        error={deadlines.error ?? reminders.error}
        fallback="No fue posible cargar el calendario."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => moveMonth(-1)}
                aria-label="Mes anterior"
              >
                <ChevronLeft size={18} />
              </Button>
              <h2 className="min-w-44 text-center text-lg font-semibold text-slate-900">
                {capitalize(monthTitle.format(new Date(month.year, month.month, 1)))}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => moveMonth(1)}
                aria-label="Mes siguiente"
              >
                <ChevronRight size={18} />
              </Button>
              <Button variant="outline" size="sm" className="ml-2" onClick={goToday}>
                Hoy
              </Button>
            </div>
            <Legend />
          </div>
          <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((name) => (
              <div key={name} className="py-2">
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day, index) => {
              const items = days(day)
              const inMonth = fromDateKey(day).getMonth() === month.month
              const chips = [
                ...items.deadlines.map((item) => ({
                  key: item.id,
                  text: item.numeroRadicado,
                  className: TONE_CHIP[getDeadlineTone(item)],
                })),
                ...items.reminders.map((item) => ({
                  key: item.id,
                  text: item.titulo,
                  className: cn(
                    'bg-violet-50 text-violet-800 ring-violet-200',
                    item.hecho && 'line-through opacity-60',
                  ),
                })),
                ...items.tasks.map((item) => ({
                  key: item.id,
                  text: item.titulo,
                  className: 'bg-slate-50 text-slate-700 ring-slate-200',
                })),
              ]
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  aria-pressed={selected === day}
                  className={cn(
                    'flex min-h-28 flex-col gap-1 border-border p-1.5 text-left align-top transition hover:bg-primary/[0.03]',
                    index % 7 !== 6 && 'border-r',
                    index < 35 && 'border-b',
                    !inMonth && 'bg-muted/30',
                    selected === day && 'bg-primary/5 ring-2 ring-inset ring-primary/40',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-7 place-items-center rounded-full text-sm tabular-nums',
                      day === today
                        ? 'bg-primary font-bold text-white'
                        : inMonth
                          ? 'font-medium text-slate-800'
                          : 'text-muted-foreground',
                    )}
                  >
                    {fromDateKey(day).getDate()}
                  </span>
                  {chips.slice(0, 3).map((chip) => (
                    <span
                      key={chip.key}
                      className={cn(
                        'truncate rounded px-1.5 py-0.5 text-[0.7rem] font-medium ring-1',
                        chip.className,
                      )}
                    >
                      {chip.text}
                    </span>
                  ))}
                  {chips.length > 3 && (
                    <span className="px-1 text-[0.7rem] font-medium text-muted-foreground">
                      +{chips.length - 3} más
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <aside className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm xl:self-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {selected === today ? 'Hoy' : 'Día elegido'}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{formatLongDate(selected)}</h2>
          </div>
          {!selectedItems.deadlines.length &&
          !selectedItems.reminders.length &&
          !selectedItems.tasks.length ? (
            <EmptyState
              icon={Bell}
              title="Nada para este día"
              className="py-6"
              action={
                selected >= today && (
                  <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
                    <BellPlus size={15} /> Crear recordatorio
                  </Button>
                )
              }
            />
          ) : (
            <>
              {selectedItems.deadlines.length > 0 && (
                <DaySection title="Vencimientos">
                  {selectedItems.deadlines.map((item) => {
                    const tone = getDeadlineTone(item)
                    return (
                      <Link
                        key={item.id}
                        to={`/expedientes/${item.id}`}
                        className="block rounded-lg border border-border p-3 transition hover:border-primary/40 hover:bg-primary/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            {item.numeroRadicado}
                          </span>
                          <Badge variant={TONE_BADGE[tone]} dot>
                            {DEADLINE_TONE_LABELS[tone]}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-700">
                          {item.solicitantes[0]?.nombre ?? 'Sin solicitante'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.tipoTramite} · {item.estado}
                        </p>
                      </Link>
                    )
                  })}
                </DaySection>
              )}
              {selectedItems.reminders.length > 0 && (
                <DaySection title="Recordatorios">
                  {selectedItems.reminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className={cn(
                        'rounded-lg border border-violet-200 bg-violet-50/50 p-3',
                        reminder.hecho && 'opacity-70',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'font-semibold text-slate-900',
                            reminder.hecho && 'line-through',
                          )}
                        >
                          {reminder.titulo}
                        </p>
                        {canDelete(reminder) && (
                          <Button
                            variant="ghost-destructive"
                            size="icon"
                            className="-mr-1 -mt-1 size-8"
                            onClick={() => setDeleting(reminder)}
                            aria-label="Eliminar recordatorio"
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                      {reminder.creadoPor !== reminder.destinatarioUid && (
                        <p className="text-xs text-muted-foreground">
                          De {reminder.creadoPorNombre}
                        </p>
                      )}
                      {reminder.descripcion && (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">
                          {reminder.descripcion}
                        </p>
                      )}
                      {reminder.documentos.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {reminder.documentos.map((document) => (
                            <li key={document.url}>
                              <a
                                href={document.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link inline-flex items-center gap-1 text-sm"
                              >
                                <ExternalLink size={13} /> {document.nombre}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={cn(
                            'text-xs',
                            reminder.correo === 'Error' ? 'text-red-700' : 'text-muted-foreground',
                          )}
                        >
                          {EMAIL_LABEL[reminder.correo]}
                        </span>
                        {reminder.destinatarioUid === user!.uid && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={toggleDone.isPending}
                            onClick={() => toggleDone.mutate(reminder)}
                          >
                            {reminder.hecho ? (
                              <>
                                <RotateCcw size={14} /> Reabrir
                              </>
                            ) : (
                              <>
                                <Check size={14} /> Marcar como hecho
                              </>
                            )}
                          </Button>
                        )}
                        {reminder.destinatarioUid !== user!.uid && reminder.hecho && (
                          <Badge variant="success" dot>
                            Hecho
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </DaySection>
              )}
              {selectedItems.tasks.length > 0 && (
                <DaySection title="Tareas de Mi agenda">
                  {selectedItems.tasks.map((task) => (
                    <Link
                      key={task.id}
                      to="/agenda"
                      className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm transition hover:border-primary/40"
                    >
                      <ListTodo size={16} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-slate-900">{task.titulo}</span>
                      <Badge>{task.estado}</Badge>
                    </Link>
                  ))}
                </DaySection>
              )}
            </>
          )}
          <ErrorAlert
            error={toggleDone.error}
            fallback="No fue posible actualizar el recordatorio."
          />
        </aside>
      </div>

      {supervisor && <SentReminders reminders={sent.data ?? []} onDelete={setDeleting} />}

      {creating && (
        <ReminderDialog day={selected} personUid={personUid} onClose={() => setCreating(false)} />
      )}
      {deleting && (
        <ConfirmDialog
          open
          title="Eliminar recordatorio"
          confirmLabel="Eliminar"
          tone="destructive"
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        >
          <p>
            "{deleting.titulo}" para {deleting.destinatarioNombre}, el {formatDate(deleting.fecha)}.
            {deleting.correo === 'Pendiente' && ' Ya no se enviará el correo.'}
          </p>
          <ErrorAlert error={remove.error} fallback="No fue posible eliminar el recordatorio." />
        </ConfirmDialog>
      )}
    </section>
  )
}

function DaySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Legend() {
  const items: [string, string][] = [
    [TONE_DOT['en-plazo'], 'En plazo'],
    [TONE_DOT.proximo, 'Próximo a vencer'],
    [TONE_DOT.vencido, 'Vencido'],
    [TONE_DOT.respondido, 'Respondido'],
    [TONE_DOT['respondido-tarde'], 'Respondido tarde'],
    ['bg-violet-500', 'Recordatorio'],
  ]
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map(([dot, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={cn('size-2 rounded-full', dot)} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  )
}

/** Los recordatorios que creó quien consulta, con el estado del correo y si ya se hicieron. */
function SentReminders({
  reminders,
  onDelete,
}: {
  reminders: Reminder[]
  onDelete: (reminder: Reminder) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Recordatorios que has creado</h2>
        <p className="text-sm text-muted-foreground">
          Los últimos 60, del más lejano al más reciente: a quién, si le llegó el correo y si ya lo
          hizo.
        </p>
      </div>
      <div className="table-shell overflow-x-auto">
        <table className="data-table min-w-[820px]">
          <thead>
            <tr>
              <th>Día</th>
              <th>Para</th>
              <th>Recordatorio</th>
              <th>Correo</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reminders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Aún no has creado recordatorios.
                </td>
              </tr>
            ) : (
              reminders.map((reminder) => (
                <tr key={reminder.id}>
                  <td className="whitespace-nowrap">{formatDate(reminder.fecha)}</td>
                  <td>{reminder.destinatarioNombre}</td>
                  <td className="max-w-80 truncate" title={reminder.titulo}>
                    {reminder.titulo}
                    {reminder.documentos.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {reminder.documentos.length} doc.
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-sm" title={reminder.detalleCorreo}>
                    {reminder.correoAviso && (
                      <span
                        className={cn(
                          'block',
                          reminder.correoAviso === 'Error'
                            ? 'text-red-700'
                            : 'text-muted-foreground',
                        )}
                      >
                        Aviso: {NOTICE_LABEL[reminder.correoAviso]}
                      </span>
                    )}
                    <span
                      className={cn(
                        'block',
                        reminder.correo === 'Error' ? 'text-red-700' : 'text-muted-foreground',
                      )}
                    >
                      Del día: {DAY_LABEL[reminder.correo]}
                    </span>
                  </td>
                  <td>
                    <Badge variant={reminder.hecho ? 'success' : 'default'} dot>
                      {reminder.hecho ? 'Hecho' : 'Pendiente'}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Button
                      variant="ghost-destructive"
                      size="icon"
                      onClick={() => onDelete(reminder)}
                      aria-label="Eliminar recordatorio"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
