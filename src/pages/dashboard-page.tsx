import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import { useWorkTray } from '@/hooks/use-work-tray'
import { updateExpedientAssignee, updateExpedientPriority } from '@/services/expedient.service'
import { EXPEDIENT_PRIORITIES, EXPEDIENT_STATUSES } from '@/types/expedient'

export function DashboardPage() {
  const { user, profile, hasRole } = useAuth()
  const client = useQueryClient()
  const { data = [], isLoading } = useWorkTray(profile?.rol, user?.uid)
  const { data: officials = [] } = useAssignableOfficials()
  const { data: procedureTypes = [] } = useProcedureTypes()
  const [status, setStatus] = useState(''); const [municipality, setMunicipality] = useState(''); const [official, setOfficial] = useState(''); const [type, setType] = useState(''); const [priority, setPriority] = useState('')
  const manageTray = hasRole(['Administrador', 'Coordinador'])
  const refresh = () => client.invalidateQueries({ queryKey: ['work-tray'] })
  const priorityMutation = useMutation({ mutationFn: ({ id, value }: { id: string; value: typeof EXPEDIENT_PRIORITIES[number] | undefined }) => updateExpedientPriority(id, value, user!.uid), onSuccess: refresh })
  const assigneeMutation = useMutation({ mutationFn: ({ id, uid }: { id: string; uid: string }) => { const value = officials.find((item) => item.uid === uid); return updateExpedientAssignee(id, value ? { uid: value.uid, nombreCompleto: value.nombreCompleto } : undefined, user!.uid) }, onSuccess: refresh })
  const municipalities = [...new Set(data.map((item) => item.predios[0]?.municipio).filter(Boolean))]
  const rows = useMemo(() => data.filter((item) => (!status || item.estado === status) && (!municipality || item.predios.some((property) => property.municipio === municipality)) && (!official || item.funcionarioAsignado?.uid === official) && (!type || item.tipoTramiteId === type) && (!priority || item.prioridad === priority)), [data, municipality, official, priority, status, type])
  const sections = [
    ['Vencidos', rows.filter((item) => item.estadoTermino === 'Vencido')],
    ['Próximos a vencer', rows.filter((item) => item.estadoTermino === 'Próximo a vencer')],
    ['Pendientes de visita', rows.filter((item) => item.estado === 'Pendiente de Visita')],
    ['Pendientes de respuesta', rows.filter((item) => item.estado === 'Pendiente de Información')],
  ] as const
  return <section className="mx-auto max-w-7xl space-y-6"><div><p className="text-sm font-medium text-primary">Centro de trabajo</p><h1 className="text-2xl font-semibold">Mi bandeja</h1><p className="mt-1 text-sm text-slate-500">Prioriza y gestiona expedientes sin cambiar de pantalla.</p></div>
    <Card className="p-4"><div className="grid gap-3 md:grid-cols-5"><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option>{EXPEDIENT_STATUSES.map((value) => <option key={value}>{value}</option>)}</Select><Select value={municipality} onChange={(event) => setMunicipality(event.target.value)}><option value="">Todos los municipios</option>{municipalities.map((value) => <option key={value}>{value}</option>)}</Select><Select value={official} onChange={(event) => setOfficial(event.target.value)}><option value="">Todos los funcionarios</option>{officials.map((value) => <option key={value.uid} value={value.uid}>{value.nombreCompleto}</option>)}</Select><Select value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos los trámites</option>{procedureTypes.map((value) => <option key={value.id} value={value.id}>{value.nombre}</option>)}</Select><Select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Toda prioridad</option>{EXPEDIENT_PRIORITIES.map((value) => <option key={value}>{value}</option>)}</Select></div></Card>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{sections.map(([label, items]) => <Card key={label} className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{items.length}</p></Card>)}</div>
    <Card className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-4">Radicado</th><th>Solicitante</th><th>Trámite</th><th>Estado</th><th>Prioridad</th><th>Fecha límite</th><th>Responsable</th><th/></tr></thead><tbody>{isLoading ? <tr><td colSpan={8} className="p-8">Cargando…</td></tr> : rows.map((item) => <tr key={item.id} className="border-t"><td className="p-4 font-medium">{item.numeroRadicado}</td><td>{item.solicitantes[0]?.nombre ?? '—'}</td><td>{item.tipoTramite ?? '—'}</td><td><Badge variant={item.estadoTermino === 'Vencido' ? 'destructive' : 'info'}>{item.estado}</Badge></td><td>{manageTray ? <Select className="h-8" value={item.prioridad ?? ''} onChange={(event) => priorityMutation.mutate({ id: item.id, value: event.target.value as typeof EXPEDIENT_PRIORITIES[number] || undefined })}><option value="">Sin prioridad</option>{EXPEDIENT_PRIORITIES.map((value) => <option key={value}>{value}</option>)}</Select> : item.prioridad ?? '—'}</td><td>{item.fechaLimite?.toDate().toLocaleDateString('es-CO') ?? '—'}<small className="block text-slate-500">{item.estadoTermino}</small></td><td>{manageTray ? <Select className="h-8" value={item.funcionarioAsignado?.uid ?? ''} onChange={(event) => assigneeMutation.mutate({ id: item.id, uid: event.target.value })}><option value="">Sin asignar</option>{officials.map((value) => <option key={value.uid} value={value.uid}>{value.nombreCompleto}</option>)}</Select> : item.funcionarioAsignado?.nombreCompleto ?? 'Sin asignar'}</td><td><Link className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent" to={`/expedientes/${item.id}`}>Abrir</Link></td></tr>)}</tbody></table></Card></section>
}
