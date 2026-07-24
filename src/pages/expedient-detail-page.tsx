import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Edit3, FileText, Plus, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { useExpedientDetail, useExpedientHistory, useExpedientObservations } from '@/hooks/use-expedient-detail'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import { addExpedientObservation, updateExpedientApplicants, updateExpedientProperties, updateExpedientStatus } from '@/services/expedient.service'
import type { Applicant, Property } from '@/types/expedient'

type Tab = 'Resumen' | 'Solicitantes' | 'Predios' | 'Observaciones' | 'Historial' | 'Documentos'
const tabs: Tab[] = ['Resumen', 'Solicitantes', 'Predios', 'Observaciones', 'Historial', 'Documentos']

function date(value?: { toDate: () => Date } | null) {
  return value ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(value.toDate()) : 'Pendiente de registro'
}

export function ExpedientDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const client = useQueryClient()
  const { data: item, isLoading } = useExpedientDetail(id)
  const { data: types = [] } = useProcedureTypes()
  const { data: history = [] } = useExpedientHistory(id)
  const { data: observations = [] } = useExpedientObservations(id)
  const [tab, setTab] = useState<Tab>('Resumen')
  const [observation, setObservation] = useState('')
  const [applicant, setApplicant] = useState<Applicant>({ nombre: '', documento: '' })
  const [property, setProperty] = useState<Property>({ municipio: 'Girardota', direccion: '' })
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['expedient', id] }); await client.invalidateQueries({ queryKey: ['expedient-history', id] }); await client.invalidateQueries({ queryKey: ['expedient-observations', id] }); await client.invalidateQueries({ queryKey: ['expedients'] }); await client.invalidateQueries({ queryKey: ['work-tray'] }) }
  const statusMutation = useMutation({ mutationFn: (status: Parameters<typeof updateExpedientStatus>[1]) => updateExpedientStatus(id!, status, user!.uid), onSuccess: refresh })
  const applicantMutation = useMutation({ mutationFn: (values: Applicant[]) => updateExpedientApplicants(id!, values, user!.uid), onSuccess: refresh })
  const propertyMutation = useMutation({ mutationFn: (values: Property[]) => updateExpedientProperties(id!, values, user!.uid), onSuccess: refresh })
  const observationMutation = useMutation({ mutationFn: () => addExpedientObservation(id!, observation, user!.uid), onSuccess: async () => { setObservation(''); await refresh() } })

  if (isLoading) return <p className="text-sm text-slate-500">Cargando expediente…</p>
  if (!item) return <p className="text-sm text-slate-500">No se encontró el expediente solicitado.</p>
  const flow = types.find((type) => type.id === item.tipoTramiteId)?.flujoEstados ?? [item.estado]
  const statusIndex = Math.max(0, flow.indexOf(item.estado))

  return <section className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary"><ArrowLeft size={15} /> Volver a la bandeja</Link><p className="mt-3 text-sm font-medium text-primary">Expediente {item.numeroRadicado}</p><h1 className="text-2xl font-semibold text-slate-900">Gestión del trámite</h1></div><div className="flex gap-2"><Badge variant="info">{item.estadoTermino ?? 'Sin término'}</Badge><Badge>{item.diasRestantes ?? '—'} días hábiles</Badge><Badge variant={item.prioridad === 'Alta' ? 'destructive' : 'default'}>{item.prioridad ?? 'Sin prioridad'}</Badge></div></div>

    <Card className="overflow-x-auto p-4"><div className="flex min-w-[700px] gap-3">{flow.map((status, index) => <div key={status} className="flex min-w-36 flex-1 items-center gap-3"><button type="button" disabled={statusMutation.isPending || (index !== statusIndex - 1 && index !== statusIndex + 1 && index !== statusIndex)} onClick={() => statusMutation.mutate(status)} className={`flex w-full flex-col rounded-lg border p-3 text-left transition ${index === statusIndex ? 'border-primary bg-primary text-primary-foreground' : index < statusIndex ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white hover:border-primary disabled:cursor-not-allowed disabled:opacity-60'}`}><span className="mb-2 flex size-6 items-center justify-center rounded-full bg-black/10 text-xs">{index < statusIndex ? <Check size={14} /> : index + 1}</span><span className="text-sm font-semibold">{status}</span><span className="text-xs opacity-80">{index === statusIndex ? 'Estado actual' : index === statusIndex + 1 ? 'Avanzar' : index === statusIndex - 1 ? 'Regresar' : 'Paso del flujo'}</span></button>{index < flow.length - 1 && <span className="text-slate-300">→</span>}</div>)}</div><p className="mt-3 text-xs text-slate-500">Selecciona el paso anterior o siguiente para cambiar el estado conforme al flujo configurado.</p></Card>

    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">{tabs.map((value) => <button key={value} type="button" onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${tab === value ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>{value}</button>)}</div>
    <Card className="p-5">
      {tab === 'Resumen' && <div className="grid gap-5 md:grid-cols-2"><div><h2 className="font-semibold">Información general</h2><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-slate-500">Tipo de trámite</dt><dd>{item.tipoTramite ?? 'Sin configurar'}</dd></div><div><dt className="text-slate-500">Fecha de radicado</dt><dd>{date(item.fechaRadicado)}</dd></div><div><dt className="text-slate-500">Responsable</dt><dd>{item.funcionarioAsignado?.nombreCompleto ?? 'Sin asignar'}</dd></div></dl></div><div><h2 className="font-semibold">Observaciones iniciales</h2><p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.observacionesIniciales ?? 'Sin observaciones iniciales.'}</p></div></div>}
      {tab === 'Solicitantes' && <div className="space-y-3"><h2 className="font-semibold">Solicitantes</h2>{item.solicitantes.map((value, index) => <div key={`${value.documento}-${index}`} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span><b>{value.nombre || 'Sin nombre'}</b> · {value.documento || 'Sin documento'} · {value.tipoSolicitante || 'Sin tipo'}</span><div><Button variant="ghost" size="sm" aria-label="Editar solicitante" onClick={() => { const nombre = window.prompt('Nombre del solicitante', value.nombre ?? ''); if (nombre?.trim()) applicantMutation.mutate(item.solicitantes.map((entry, position) => position === index ? { ...entry, nombre } : entry)) }}><Edit3 size={15}/></Button><Button variant="ghost" size="sm" onClick={() => applicantMutation.mutate(item.solicitantes.filter((_, position) => position !== index))}><Trash2 size={15} className="text-destructive" /></Button></div></div>)}<div className="grid gap-2 border-t pt-4 sm:grid-cols-3"><Input value={applicant.nombre} onChange={(event) => setApplicant({ ...applicant, nombre: event.target.value })} placeholder="Nombre"/><Input value={applicant.documento} onChange={(event) => setApplicant({ ...applicant, documento: event.target.value })} placeholder="Documento"/><Button disabled={!applicant.nombre?.trim() || applicantMutation.isPending} onClick={() => { applicantMutation.mutate([...item.solicitantes, applicant]); setApplicant({ nombre: '', documento: '' }) }}><Plus size={16}/> Agregar</Button></div></div>}
      {tab === 'Predios' && <div className="space-y-3"><h2 className="font-semibold">Predios</h2>{item.predios.map((value, index) => <div key={`${value.numeroPredial}-${index}`} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span><b>{value.municipio || 'Sin municipio'}</b> · {value.direccion || 'Sin dirección'} · {value.numeroPredial || 'Sin número predial'}</span><div><Button variant="ghost" size="sm" aria-label="Editar predio" onClick={() => { const direccion = window.prompt('Dirección del predio', value.direccion ?? ''); if (direccion?.trim()) propertyMutation.mutate(item.predios.map((entry, position) => position === index ? { ...entry, direccion } : entry)) }}><Edit3 size={15}/></Button><Button variant="ghost" size="sm" onClick={() => propertyMutation.mutate(item.predios.filter((_, position) => position !== index))}><Trash2 size={15} className="text-destructive" /></Button></div></div>)}<div className="grid gap-2 border-t pt-4 sm:grid-cols-3"><Input value={property.municipio} onChange={(event) => setProperty({ ...property, municipio: event.target.value })} placeholder="Municipio"/><Input value={property.direccion} onChange={(event) => setProperty({ ...property, direccion: event.target.value })} placeholder="Dirección"/><Button disabled={!property.direccion?.trim() || propertyMutation.isPending} onClick={() => { propertyMutation.mutate([...item.predios, property]); setProperty({ municipio: 'Girardota', direccion: '' }) }}><Plus size={16}/> Agregar</Button></div></div>}
      {tab === 'Observaciones' && <div className="space-y-4"><h2 className="font-semibold">Observaciones</h2><Textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Registra una observación; quedará como parte del historial inmutable."/><Button disabled={!observation.trim() || observationMutation.isPending} onClick={() => observationMutation.mutate()}><Send size={16}/> Registrar observación</Button>{observations.map((value) => <article key={value.id} className="rounded-lg border border-slate-200 p-3"><p className="whitespace-pre-wrap text-sm">{value.contenido}</p><p className="mt-2 text-xs text-slate-500">{value.creadoPor} · {date(value.fechaCreacion)}</p></article>)}</div>}
      {tab === 'Historial' && <div className="space-y-4"><h2 className="font-semibold">Historial del expediente</h2>{history.length ? history.map((value) => <article key={value.id} className="border-l-2 border-primary/30 pl-4"><p className="text-sm font-medium">{value.accion}</p>{value.detalle && <p className="mt-1 text-sm text-slate-600">{value.detalle}</p>}<p className="mt-1 text-xs text-slate-500">{value.usuario} · {date(value.fecha)}</p></article>) : <p className="text-sm text-slate-500">Aún no hay eventos registrados.</p>}</div>}
      {tab === 'Documentos' && <div className="py-6 text-center"><FileText className="mx-auto text-slate-400" size={28}/><h2 className="mt-3 font-semibold">Documentos del expediente</h2><p className="mt-1 text-sm text-slate-500">La consulta documental estará disponible cuando se habilite Firebase Storage.</p></div>}
    </Card>
  </section>
}
