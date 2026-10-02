import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Mail,
  Trash2,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Alert, ErrorAlert, LoadingState } from '@/components/ui/feedback'
import { Field, Switch } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast-context'
import { useAuth } from '@/hooks/use-auth'
import { useBusinessConfiguration } from '@/hooks/use-business-configuration'
import { getColombianHolidays, isColombianHoliday } from '@/lib/colombian-holidays'
import { formatLongDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { saveBusinessConfiguration } from '@/services/business-rules.service'
import { getEmailTestRequest, requestEmailTest } from '@/services/email-test.service'
import { listAlertRecipients, setDeadlineEmailAlerts } from '@/services/user-profile.service'

const deadlineSchema = z.object({
  umbralProximoVencer: z.coerce.number().int().min(1, 'Mínimo 1 día.').max(30, 'Máximo 30 días.'),
})

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function NationalHolidays() {
  const [year, setYear] = useState(new Date().getFullYear())
  const holidays = getColombianHolidays(year)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {holidays.length} festivos nacionales en {year}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setYear(year - 1)}
            aria-label="Año anterior"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="w-12 text-center text-sm font-semibold tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setYear(year + 1)}
            aria-label="Año siguiente"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {holidays.map((holiday) => (
          <li
            key={holiday.date}
            className="flex justify-between gap-3 border-b border-border/60 py-1.5 text-sm"
          >
            <span className="text-slate-700">{holiday.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {formatLongDate(holiday.date).replace(/ de \d{4}$/, '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SettingsPage() {
  const client = useQueryClient()
  const toast = useToast()
  const { profile } = useAuth()
  const { data, isLoading } = useBusinessConfiguration()
  const { data: officials = [] } = useQuery({
    queryKey: ['alert-recipients'],
    queryFn: listAlertRecipients,
  })
  const [open, setOpen] = useState(false)
  const [recipientUid, setRecipientUid] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<string[]>([])
  const [holiday, setHoliday] = useState('')
  const form = useForm<z.input<typeof deadlineSchema>, unknown, z.output<typeof deadlineSchema>>({
    resolver: zodResolver(deadlineSchema),
    defaultValues: { umbralProximoVencer: 3 },
  })

  useEffect(() => {
    if (!data) return
    setHolidays(data.diasFestivos)
    form.reset({ umbralProximoVencer: data.umbralProximoVencer })
  }, [data, form])

  const recipients =
    profile && !officials.some((item) => item.uid === profile.uid)
      ? [profile, ...officials]
      : officials
  const { data: request } = useQuery({
    queryKey: ['email-test-request', requestId],
    queryFn: () => getEmailTestRequest(requestId as string),
    enabled: requestId !== null,
    refetchInterval: (query) => (query.state.data?.estado === 'Pendiente' ? 3000 : false),
  })
  useEffect(() => {
    if (request?.estado === 'Enviado')
      toast({
        title: 'Correo de prueba enviado',
        description: 'Revisa la bandeja del destinatario.',
      })
    if (request?.estado === 'Error')
      toast({
        tone: 'error',
        title: 'No fue posible enviar el correo',
        description: request.detalleError ?? 'Error desconocido.',
      })
  }, [request, toast])

  const refresh = () => client.invalidateQueries({ queryKey: ['business-configuration'] })
  const setService = useMutation({
    mutationFn: (enabled: boolean) =>
      saveBusinessConfiguration({
        diasFestivos: data?.diasFestivos ?? [],
        umbralProximoVencer: data?.umbralProximoVencer ?? 3,
        alertasCorreoHabilitadas: enabled,
      }),
    onSuccess: refresh,
  })
  const saveDeadlineSettings = useMutation({
    mutationFn: (values: { umbralProximoVencer: number }) =>
      saveBusinessConfiguration({
        ...values,
        diasFestivos: holidays,
        alertasCorreoHabilitadas: data?.alertasCorreoHabilitadas ?? false,
      }),
    onSuccess: async () => {
      await refresh()
      toast({
        title: 'Configuración guardada',
        description: 'Los términos se recalculan al consultar cada expediente.',
      })
    },
  })
  const setReceiver = useMutation({
    mutationFn: ({ uid, enabled }: { uid: string; enabled: boolean }) =>
      setDeadlineEmailAlerts(uid, enabled),
    onSuccess: () => client.invalidateQueries({ queryKey: ['alert-recipients'] }),
  })
  const sendTest = useMutation({
    mutationFn: async () => {
      const recipient = recipients.find((item) => item.uid === recipientUid)
      if (!recipient || !profile) throw new Error('Selecciona el destinatario.')
      const id = await requestEmailTest(
        { nombre: recipient.nombreCompleto, correo: recipient.correo },
        { uid: profile.uid, correo: profile.correo },
      )
      return { id, recipient }
    },
    onSuccess: ({ id, recipient }) => {
      setOpen(false)
      setRecipientUid('')
      setRequestId(id)
      toast({
        tone: 'info',
        title: 'Solicitud de prueba registrada',
        description: `Para ${recipient.nombreCompleto}. Esperando confirmación del envío…`,
      })
    },
  })

  if (isLoading) return <LoadingState label="Cargando configuración…" />
  const dirty = form.formState.isDirty || holidays.join() !== (data?.diasFestivos ?? []).join()
  const alertsEnabled = data?.alertasCorreoHabilitadas ?? false

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        kicker="Administración"
        title="Configuración"
        description="Reglas de términos, calendario de días hábiles y alertas por correo."
      />
      <form
        onSubmit={form.handleSubmit((values) => saveDeadlineSettings.mutate(values))}
        className="space-y-6"
      >
        <ErrorAlert error={saveDeadlineSettings.error} fallback="No fue posible guardar." />
        <Section
          icon={<Bell size={20} />}
          title="Semáforo de términos"
          description="Cuándo un expediente pasa a “Próximo a vencer”."
        >
          <Field
            label="Días hábiles de anticipación"
            className="max-w-xs"
            error={form.formState.errors.umbralProximoVencer?.message}
            hint="También define cuándo se envían las alertas por correo."
          >
            <Input type="number" min="1" max="30" {...form.register('umbralProximoVencer')} />
          </Field>
        </Section>

        <Section
          icon={<CalendarDays size={20} />}
          title="Festivos de Colombia"
          description="Se calculan automáticamente cada año (Ley 51 de 1983 y calendario litúrgico). No hay que registrarlos."
        >
          <NationalHolidays />
        </Section>

        <Section
          icon={<CalendarPlus size={20} />}
          title="Días adicionales sin atención"
          description="Cierres decretados por la Alcaldía, jornadas especiales o suspensión de términos. Tampoco cuentan como hábiles."
        >
          <div className="flex gap-2">
            <Input
              type="date"
              value={holiday}
              onChange={(event) => setHoliday(event.target.value)}
              className="max-w-xs"
              aria-label="Fecha sin atención"
            />
            <Button
              variant="outline"
              disabled={!holiday || holidays.includes(holiday) || isColombianHoliday(holiday)}
              onClick={() => {
                setHolidays([...holidays, holiday].sort())
                setHoliday('')
              }}
            >
              <CalendarPlus size={16} /> Agregar
            </Button>
          </div>
          {holiday && isColombianHoliday(holiday) && (
            <p className="mt-2 text-xs text-muted-foreground">Esa fecha ya es festivo nacional.</p>
          )}
          <ul className="mt-4 flex flex-wrap gap-2">
            {holidays.map((value) => (
              <li
                key={value}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1 text-sm"
              >
                <span>{formatLongDate(value)}</span>
                {isColombianHoliday(value) && (
                  <span className="text-xs text-muted-foreground">(ya es festivo)</span>
                )}
                <button
                  type="button"
                  onClick={() => setHolidays(holidays.filter((item) => item !== value))}
                  className="grid size-6 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-destructive"
                  aria-label={`Quitar ${value}`}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
            {!holidays.length && (
              <li className="text-sm text-muted-foreground">
                No hay días adicionales registrados.
              </li>
            )}
          </ul>
        </Section>

        <div
          className={cn(
            'sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-xl border border-border bg-white/95 p-3 shadow-lg backdrop-blur transition',
            !dirty && 'opacity-80',
          )}
        >
          {dirty && <p className="mr-auto text-sm text-amber-700">Tienes cambios sin guardar.</p>}
          <Button type="submit" disabled={saveDeadlineSettings.isPending || !dirty}>
            {saveDeadlineSettings.isPending ? 'Guardando…' : 'Guardar configuración'}
          </Button>
        </div>
      </form>

      <Section
        icon={<Mail size={20} />}
        title="Alertas por correo"
        description="Aviso diario a las 8 a. m. a los responsables cuyos expedientes están por vencer."
      >
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
          <div>
            <p className="font-medium text-slate-900">
              Servicio {alertsEnabled ? 'activo' : 'inactivo'}
            </p>
            <p className="text-sm text-muted-foreground">
              Requiere el script de Google Apps Script instalado (ver README).
            </p>
          </div>
          <Switch
            checked={alertsEnabled}
            disabled={setService.isPending}
            onChange={(value) => setService.mutate(value)}
            label="Activar alertas por correo"
          />
        </div>
        <ErrorAlert
          error={setService.error ?? setReceiver.error}
          fallback="No fue posible actualizar las alertas."
        />
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {officials.map((official) => (
            <li key={official.uid} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {official.nombreCompleto}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {official.correo}
                </span>
              </span>
              <Switch
                checked={official.recibeAlertasVencimiento === true}
                disabled={setReceiver.isPending}
                onChange={(enabled) => setReceiver.mutate({ uid: official.uid, enabled })}
                label={`Alertas para ${official.nombreCompleto}`}
              />
            </li>
          ))}
          {!officials.length && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No hay funcionarios activos.
            </li>
          )}
        </ul>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" disabled={!recipients.length} onClick={() => setOpen(true)}>
            <Mail size={16} /> Enviar correo de prueba
          </Button>
        </div>
      </Section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        busy={sendTest.isPending}
        title="Correo de prueba"
        description="Comprueba que el script de correos está funcionando."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!recipientUid || sendTest.isPending}
              onClick={() => sendTest.mutate()}
            >
              {sendTest.isPending ? 'Solicitando…' : 'Enviar prueba'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ErrorAlert error={sendTest.error} fallback="No fue posible registrar la prueba." />
          <Alert tone="info">
            Recibirás una copia en <b>{profile?.correo}</b>.
          </Alert>
          <Field label="Destinatario" required>
            <Select value={recipientUid} onChange={(event) => setRecipientUid(event.target.value)}>
              <option value="">Selecciona una persona</option>
              {recipients.map((recipient) => (
                <option key={recipient.uid} value={recipient.uid}>
                  {recipient.nombreCompleto} — {recipient.correo}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </section>
  )
}
