import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CalendarPlus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useBusinessConfiguration } from '@/hooks/use-business-configuration'
import { saveBusinessConfiguration } from '@/services/business-rules.service'
import { getEmailTestRequest, requestEmailTest } from '@/services/email-test.service'
import { listAssignableOfficials, setDeadlineEmailAlerts } from '@/services/user-profile.service'

const deadlineSchema = z.object({ umbralProximoVencer: z.coerce.number().int().min(1).max(30) })

export function SettingsPage() {
  const client = useQueryClient()
  const { profile } = useAuth()
  const { data, isLoading } = useBusinessConfiguration()
  const { data: officials = [] } = useQuery({ queryKey: ['assignable-officials'], queryFn: listAssignableOfficials })
  const [open, setOpen] = useState(false)
  const [recipientUid, setRecipientUid] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<string[]>([])
  const [holiday, setHoliday] = useState('')
  const form = useForm<{ umbralProximoVencer: number }>({ resolver: zodResolver(deadlineSchema), defaultValues: { umbralProximoVencer: 3 } })

  useEffect(() => {
    if (!data) return
    setHolidays(data.diasFestivos)
    form.reset({ umbralProximoVencer: data.umbralProximoVencer })
  }, [data, form])

  const recipients = profile && !officials.some((item) => item.uid === profile.uid) ? [profile, ...officials] : officials
  const { data: request } = useQuery({
    queryKey: ['email-test-request', requestId],
    queryFn: () => getEmailTestRequest(requestId as string),
    enabled: requestId !== null,
    refetchInterval: (query) => query.state.data?.estado === 'Pendiente' ? 3000 : false,
  })
  useEffect(() => {
    if (request?.estado === 'Enviado') setNotice('Correo de prueba enviado correctamente. Revisa la bandeja del destinatario y tu copia.')
    if (request?.estado === 'Error') setNotice('No fue posible enviar el correo: ' + (request.detalleError ?? 'error desconocido') + '.')
  }, [request])

  const refresh = () => client.invalidateQueries({ queryKey: ['business-configuration'] })
  const setService = useMutation({
    mutationFn: (enabled: boolean) => saveBusinessConfiguration({ diasFestivos: data?.diasFestivos ?? [], umbralProximoVencer: data?.umbralProximoVencer ?? 3, alertasCorreoHabilitadas: enabled }),
    onSuccess: refresh,
  })
  const saveDeadlineSettings = useMutation({
    mutationFn: (values: { umbralProximoVencer: number }) => saveBusinessConfiguration({ ...values, diasFestivos: holidays, alertasCorreoHabilitadas: data?.alertasCorreoHabilitadas ?? false }),
    onSuccess: refresh,
  })
  const setReceiver = useMutation({
    mutationFn: ({ uid, enabled }: { uid: string; enabled: boolean }) => setDeadlineEmailAlerts(uid, enabled),
    onSuccess: () => client.invalidateQueries({ queryKey: ['assignable-officials'] }),
  })
  const sendTest = useMutation({
    mutationFn: async () => {
      const recipient = recipients.find((item) => item.uid === recipientUid)
      if (!recipient || !profile) throw new Error('Selecciona el destinatario.')
      const id = await requestEmailTest({ nombre: recipient.nombreCompleto, correo: recipient.correo }, { uid: profile.uid, correo: profile.correo })
      return { id, recipient }
    },
    onSuccess: ({ id, recipient }) => {
      setOpen(false)
      setRecipientUid('')
      setRequestId(id)
      setNotice('Solicitud registrada para ' + recipient.nombreCompleto + ' (' + recipient.correo + '). Esperando confirmacion del envio...')
    },
  })

  if (isLoading) return <p className="text-sm text-slate-500">Cargando configuración…</p>
  return <section className="mx-auto max-w-4xl space-y-6">
    <div><p className="text-sm font-medium text-primary">Administración</p><h1 className="text-2xl font-semibold">Configuración</h1></div>
    <form onSubmit={form.handleSubmit((values) => saveDeadlineSettings.mutate(values))} className="space-y-5"><Card className="p-5"><h2 className="font-semibold">Términos y semaforización</h2><label className="mt-4 block max-w-sm text-sm font-medium">Días hábiles para “Próximo a vencer”<Input className="mt-1" type="number" min="1" max="30" {...form.register('umbralProximoVencer')} /></label></Card><Card className="p-5"><h2 className="font-semibold">Días festivos</h2><div className="mt-4 flex gap-2"><Input type="date" value={holiday} onChange={(event) => setHoliday(event.target.value)} /><Button type="button" variant="outline" disabled={!holiday || holidays.includes(holiday)} onClick={() => { setHolidays([...holidays, holiday].sort()); setHoliday('') }}><CalendarPlus size={16} /> Agregar</Button></div><div className="mt-4 space-y-2">{holidays.length ? holidays.map((value) => <div key={value} className="flex items-center justify-between rounded-md border p-2 text-sm"><span>{new Date(`${value}T00:00:00`).toLocaleDateString('es-CO')}</span><Button type="button" variant="ghost" size="sm" onClick={() => setHolidays(holidays.filter((item) => item !== value))}><Trash2 size={15} className="text-destructive" /></Button></div>) : <p className="text-sm text-slate-500">No hay festivos configurados.</p>}</div></Card><div className="flex justify-end"><Button type="submit" disabled={saveDeadlineSettings.isPending}>{saveDeadlineSettings.isPending ? 'Guardando…' : 'Guardar configuración'}</Button></div></form>
    <Card className="p-5"><h2 className="font-semibold">Alertas por correo</h2><div className="mt-4 flex items-center justify-between"><p className="text-sm text-slate-500">Habilita las alertas diarias de vencimiento.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={data?.alertasCorreoHabilitadas ?? false} disabled={setService.isPending} onChange={(event) => setService.mutate(event.target.checked)} />{data?.alertasCorreoHabilitadas ? 'Activo' : 'Inactivo'}</label></div><div className="mt-5 divide-y rounded-md border">{officials.map((official) => <label key={official.uid} className="flex items-center justify-between gap-3 p-3"><span><b className="block text-sm">{official.nombreCompleto}</b><small>{official.correo}</small></span><span className="flex items-center gap-2 text-sm"><input type="checkbox" checked={official.recibeAlertasVencimiento === true} onChange={(event) => setReceiver.mutate({ uid: official.uid, enabled: event.target.checked })} />Recibe alertas</span></label>)}</div><div className="mt-4 flex justify-end"><Button type="button" variant="outline" disabled={!recipients.length} onClick={() => { setNotice(null); setOpen(true) }}><Bell size={16} /> Enviar correo de prueba</Button></div>{notice && <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}</Card>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><Card className="w-full max-w-md p-6"><h2 className="text-lg font-semibold">Correo de prueba</h2><p className="mt-2 text-sm text-slate-500">El administrador también aparece como destinatario disponible.</p><p className="mt-3 rounded bg-slate-50 p-3 text-sm">Solicitado por:<br /><b>{profile?.nombreCompleto}</b><br />{profile?.correo}<br /><small>Recibirás una copia del correo.</small></p><label className="mt-4 block text-sm font-medium">Destinatario<Select className="mt-1" value={recipientUid} onChange={(event) => setRecipientUid(event.target.value)}><option value="">Selecciona una persona</option>{recipients.map((recipient) => <option key={recipient.uid} value={recipient.uid}>{recipient.nombreCompleto} — {recipient.correo}</option>)}</Select></label><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" disabled={!recipientUid || sendTest.isPending} onClick={() => sendTest.mutate()}>{sendTest.isPending ? 'Solicitando…' : 'Enviar prueba'}</Button></div></Card></div>}
  </section>
}
