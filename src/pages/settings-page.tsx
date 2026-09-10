import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CalendarPlus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBusinessConfiguration } from '@/hooks/use-business-configuration'
import { saveBusinessConfiguration, type BusinessConfiguration } from '@/services/business-rules.service'
import { listAssignableOfficials, setDeadlineEmailAlerts } from '@/services/user-profile.service'

const schema = z.object({ umbralProximoVencer: z.coerce.number().int().min(1).max(30) })

export function SettingsPage() {
  const client = useQueryClient()
  const { data, isLoading } = useBusinessConfiguration()
  const { data: officials = [], isLoading: officialsLoading } = useQuery({ queryKey: ['assignable-officials'], queryFn: listAssignableOfficials })
  const [holidays, setHolidays] = useState<string[]>([])
  const [holiday, setHoliday] = useState('')
  const form = useForm<Pick<Required<BusinessConfiguration>, 'umbralProximoVencer'>>({ resolver: zodResolver(schema), defaultValues: { umbralProximoVencer: 3 } })

  useEffect(() => {
    if (!data) return
    setHolidays(data.diasFestivos)
    form.reset({ umbralProximoVencer: data.umbralProximoVencer })
  }, [data, form])

  const refreshConfiguration = () => client.invalidateQueries({ queryKey: ['business-configuration'] })
  const save = useMutation({
    mutationFn: (values: Pick<Required<BusinessConfiguration>, 'umbralProximoVencer'>) => saveBusinessConfiguration({ ...values, diasFestivos: holidays, alertasCorreoHabilitadas: data?.alertasCorreoHabilitadas ?? false }),
    onSuccess: refreshConfiguration,
  })
  const setEmailService = useMutation({
    mutationFn: (enabled: boolean) => saveBusinessConfiguration({ diasFestivos: data?.diasFestivos ?? [], umbralProximoVencer: data?.umbralProximoVencer ?? 3, alertasCorreoHabilitadas: enabled }),
    onSuccess: refreshConfiguration,
  })
  const setRecipient = useMutation({
    mutationFn: ({ uid, enabled }: { uid: string; enabled: boolean }) => setDeadlineEmailAlerts(uid, enabled),
    onSuccess: () => client.invalidateQueries({ queryKey: ['assignable-officials'] }),
  })

  if (isLoading) return <p className="text-sm text-slate-500">Cargando configuración…</p>

  return <section className="mx-auto max-w-4xl space-y-6"><div><p className="text-sm font-medium text-primary">Administración</p><h1 className="text-2xl font-semibold">Configuración</h1><p className="mt-1 text-sm text-slate-500">Parámetros institucionales utilizados por el cálculo automático de términos.</p></div><form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-5"><Card className="p-5"><h2 className="font-semibold">Términos y semaforización</h2><label className="mt-4 block max-w-sm text-sm font-medium">Días hábiles para “Próximo a vencer”<Input className="mt-1" type="number" min="1" max="30" {...form.register('umbralProximoVencer')} /><small className="text-slate-500">Un expediente entra en alerta cuando le quedan estos días hábiles o menos.</small></label></Card><Card className="p-5"><h2 className="font-semibold">Días festivos</h2><p className="mt-1 text-sm text-slate-500">Estos días no se contabilizan como hábiles en ningún trámite.</p><div className="mt-4 flex gap-2"><Input type="date" value={holiday} onChange={(event) => setHoliday(event.target.value)} /><Button type="button" variant="outline" disabled={!holiday || holidays.includes(holiday)} onClick={() => { setHolidays([...holidays, holiday].sort()); setHoliday('') }}><CalendarPlus size={16} /> Agregar</Button></div><div className="mt-4 space-y-2">{holidays.length ? holidays.map((value) => <div key={value} className="flex items-center justify-between rounded-md border p-2 text-sm"><span>{new Date(`${value}T00:00:00`).toLocaleDateString('es-CO')}</span><Button type="button" variant="ghost" size="sm" onClick={() => setHolidays(holidays.filter((item) => item !== value))}><Trash2 size={15} className="text-destructive" /></Button></div>) : <p className="text-sm text-slate-500">No hay festivos configurados.</p>}</div></Card><div className="flex justify-end"><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar configuración'}</Button></div></form><Card className="p-5"><div className="flex items-start justify-between gap-6"><div><div className="flex items-center gap-2 font-semibold"><Bell size={18} /> Alertas por correo</div><p className="mt-1 text-sm text-slate-500">El proceso diario de Google Apps Script enviará alertas sólo a los funcionarios habilitados abajo.</p></div><label className="flex shrink-0 items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-primary" checked={data?.alertasCorreoHabilitadas ?? false} disabled={setEmailService.isPending} onChange={(event) => setEmailService.mutate(event.target.checked)} />{data?.alertasCorreoHabilitadas ? 'Activo' : 'Inactivo'}</label></div><div className="mt-5 divide-y rounded-md border">{officialsLoading ? <p className="p-3 text-sm text-slate-500">Cargando funcionarios…</p> : officials.length ? officials.map((official) => <label key={official.uid} className="flex cursor-pointer items-center justify-between gap-4 p-3 hover:bg-slate-50"><span><span className="block text-sm font-medium">{official.nombreCompleto}</span><span className="block text-xs text-slate-500">{official.correo} · {official.rol}</span></span><span className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={official.recibeAlertasVencimiento === true} disabled={setRecipient.isPending} onChange={(event) => setRecipient.mutate({ uid: official.uid, enabled: event.target.checked })} />Recibe alertas</span></label>) : <p className="p-3 text-sm text-slate-500">No hay funcionarios o coordinadores activos.</p>}</div><p className="mt-3 text-xs text-slate-500">Los cambios se guardan de inmediato. La activación del proceso diario se realiza una sola vez en Google Apps Script.</p></Card></section>
}
