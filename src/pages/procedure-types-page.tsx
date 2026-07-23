import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EXPEDIENT_STATUSES, type ExpedientStatus } from '@/types/expedient'
import { deactivateProcedureType, saveProcedureType } from '@/services/procedure-type.service'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import type { ProcedureType } from '@/types/procedure-type'

const empty = { nombre: '', descripcion: '', diasRespuesta: 15, requiereVisita: false, requiereRevisionJuridica: false, flujoEstados: ['Recibido'] as ExpedientStatus[] }

export function ProcedureTypesPage() {
  const { data = [], isLoading } = useProcedureTypes(); const client = useQueryClient()
  const [search, setSearch] = useState(''); const [editing, setEditing] = useState<ProcedureType | undefined>(); const [form, setForm] = useState(empty)
  const refresh = () => client.invalidateQueries({ queryKey: ['procedure-types'] })
  const save = useMutation({ mutationFn: () => saveProcedureType(form, editing?.id), onSuccess: () => { void refresh(); setEditing(undefined); setForm(empty) } })
  const remove = useMutation({ mutationFn: deactivateProcedureType, onSuccess: refresh })
  const rows = useMemo(() => data.filter((item) => item.nombre.toLowerCase().includes(search.toLowerCase())), [data, search])
  const edit = (item: ProcedureType) => { setEditing(item); setForm({ nombre: item.nombre, descripcion: item.descripcion ?? '', diasRespuesta: item.diasRespuesta, requiereVisita: item.requiereVisita, requiereRevisionJuridica: item.requiereRevisionJuridica, flujoEstados: item.flujoEstados }) }
  return <section className="mx-auto max-w-6xl space-y-6"><div className="flex items-end justify-between"><div><p className="text-sm font-medium text-primary">Configuración</p><h1 className="text-2xl font-semibold text-slate-900">Tipos de trámite</h1></div><Button onClick={() => { setEditing(undefined); setForm(empty) }}><Plus size={16}/> Nuevo trámite</Button></div><Card className="p-4"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400"/><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar trámite"/></div></Card><Card className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-4">Nombre</th><th>Días</th><th>Visita</th><th>Jurídica</th><th>Flujo</th><th/></tr></thead><tbody>{isLoading ? <tr><td className="p-6" colSpan={6}>Cargando…</td></tr> : rows.map((item) => <tr key={item.id} className="border-t"><td className="p-4 font-medium">{item.nombre}<p className="text-xs text-slate-500">{item.descripcion}</p></td><td>{item.diasRespuesta}</td><td>{item.requiereVisita ? 'Sí' : 'No'}</td><td>{item.requiereRevisionJuridica ? 'Sí' : 'No'}</td><td>{item.flujoEstados.join(' → ')}</td><td className="p-3"><Button variant="ghost" size="sm" onClick={() => edit(item)}>Editar</Button><Button variant="ghost" size="sm" onClick={() => remove.mutate(item.id)}>Desactivar</Button></td></tr>)}</tbody></table></Card><Card className="p-5"><h2 className="font-semibold">{editing ? 'Editar trámite' : 'Crear trámite'}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Input value={form.nombre} onChange={(e) => setForm({...form,nombre:e.target.value})} placeholder="Nombre"/><Input type="number" min="1" value={form.diasRespuesta} onChange={(e) => setForm({...form,diasRespuesta:Number(e.target.value)})} placeholder="Días de respuesta"/><Input className="sm:col-span-2" value={form.descripcion} onChange={(e) => setForm({...form,descripcion:e.target.value})} placeholder="Descripción"/><Select multiple className="h-32 sm:col-span-2" value={form.flujoEstados} onChange={(e) => setForm({...form,flujoEstados:Array.from(e.target.selectedOptions, o => o.value as ExpedientStatus)})}>{EXPEDIENT_STATUSES.map(s=><option key={s}>{s}</option>)}</Select><label><input type="checkbox" checked={form.requiereVisita} onChange={(e)=>setForm({...form,requiereVisita:e.target.checked})}/> Requiere visita</label><label><input type="checkbox" checked={form.requiereRevisionJuridica} onChange={(e)=>setForm({...form,requiereRevisionJuridica:e.target.checked})}/> Requiere revisión jurídica</label></div><Button className="mt-4" disabled={!form.nombre || !form.flujoEstados.length || save.isPending} onClick={()=>save.mutate()}>Guardar trámite</Button></Card></section>
}
