import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EXPEDIENT_STATUSES } from '@/types/expedient'
import { deactivateProcedureType, saveProcedureType } from '@/services/procedure-type.service'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import type { ProcedureType, ProcedureTypeInput } from '@/types/procedure-type'

const procedureTypeSchema = z.object({ nombre: z.string().trim().min(1, 'Ingresa el nombre.'), descripcion: z.string().trim().optional(), diasRespuesta: z.coerce.number().int().min(1, 'Debe ser mayor que cero.'), requiereVisita: z.boolean(), requiereRevisionJuridica: z.boolean(), flujoEstados: z.array(z.enum(EXPEDIENT_STATUSES)).min(1, 'Selecciona al menos un estado.') })
const empty: ProcedureTypeInput = { nombre: '', descripcion: '', diasRespuesta: 15, requiereVisita: false, requiereRevisionJuridica: false, flujoEstados: ['Recibido'] }

export function ProcedureTypesPage() {
  const { data = [], isLoading } = useProcedureTypes(); const client = useQueryClient(); const [search, setSearch] = useState(''); const [editing, setEditing] = useState<ProcedureType | undefined>()
  const form = useForm<ProcedureTypeInput>({ resolver: zodResolver(procedureTypeSchema), defaultValues: empty })
  const refresh = () => client.invalidateQueries({ queryKey: ['procedure-types'] })
  const save = useMutation({ mutationFn: (values: ProcedureTypeInput) => saveProcedureType(values, editing?.id), onSuccess: () => { void refresh(); setEditing(undefined); form.reset(empty) } })
  const remove = useMutation({ mutationFn: deactivateProcedureType, onSuccess: refresh })
  const rows = useMemo(() => data.filter((item) => item.nombre.toLowerCase().includes(search.toLowerCase())), [data, search])
  const edit = (item: ProcedureType) => { setEditing(item); form.reset({ nombre: item.nombre, descripcion: item.descripcion ?? '', diasRespuesta: item.diasRespuesta, requiereVisita: item.requiereVisita, requiereRevisionJuridica: item.requiereRevisionJuridica, flujoEstados: item.flujoEstados }) }
  const create = () => { setEditing(undefined); form.reset(empty) }
  return <section className="mx-auto max-w-6xl space-y-6"><div className="flex items-end justify-between"><div><p className="text-sm font-medium text-primary">Configuración</p><h1 className="text-2xl font-semibold text-slate-900">Tipos de trámite</h1></div><Button onClick={create}><Plus size={16}/> Nuevo trámite</Button></div><Card className="p-4"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-400"/><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar trámite"/></div></Card><Card className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-4">Nombre</th><th>Días</th><th>Visita</th><th>Jurídica</th><th>Flujo</th><th/></tr></thead><tbody>{isLoading ? <tr><td className="p-6" colSpan={6}>Cargando…</td></tr> : rows.map((item) => <tr key={item.id} className="border-t"><td className="p-4 font-medium">{item.nombre}<p className="text-xs text-slate-500">{item.descripcion}</p></td><td>{item.diasRespuesta}</td><td>{item.requiereVisita ? 'Sí' : 'No'}</td><td>{item.requiereRevisionJuridica ? 'Sí' : 'No'}</td><td>{item.flujoEstados.join(' → ')}</td><td className="p-3"><Button variant="ghost" size="sm" onClick={() => edit(item)}>Editar</Button><Button variant="ghost" size="sm" onClick={() => remove.mutate(item.id)}>Desactivar</Button></td></tr>)}</tbody></table></Card><Card className="p-5"><h2 className="font-semibold">{editing ? 'Editar trámite' : 'Crear trámite'}</h2><form className="mt-4" onSubmit={form.handleSubmit((values) => save.mutate(values))} noValidate><div className="grid gap-3 sm:grid-cols-2"><label><Input {...form.register('nombre')} placeholder="Nombre"/>{form.formState.errors.nombre && <small className="text-destructive">{form.formState.errors.nombre.message}</small>}</label><label><Input type="number" min="1" {...form.register('diasRespuesta')} placeholder="Días de respuesta"/>{form.formState.errors.diasRespuesta && <small className="text-destructive">{form.formState.errors.diasRespuesta.message}</small>}</label><Input className="sm:col-span-2" {...form.register('descripcion')} placeholder="Descripción"/><Select multiple className="h-32 sm:col-span-2" {...form.register('flujoEstados')}>{EXPEDIENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</Select><label><input type="checkbox" {...form.register('requiereVisita')}/> Requiere visita</label><label><input type="checkbox" {...form.register('requiereRevisionJuridica')}/> Requiere revisión jurídica</label></div>{form.formState.errors.flujoEstados && <small className="mt-2 block text-destructive">{form.formState.errors.flujoEstados.message}</small>}<Button className="mt-4" disabled={save.isPending} type="submit">Guardar trámite</Button></form></Card></section>
}
