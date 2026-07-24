import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { listUsers, setUserActive } from '@/services/user-profile.service'
import { USER_ROLES } from '@/types/user'

export function UsersPage() {
  const client = useQueryClient(); const { data = [] } = useQuery({ queryKey: ['users'], queryFn: listUsers }); const [search, setSearch] = useState(''); const [role, setRole] = useState(''); const [active, setActive] = useState('')
  const toggle = useMutation({ mutationFn: ({ uid, value }: { uid: string; value: boolean }) => setUserActive(uid, value), onSuccess: () => client.invalidateQueries({ queryKey: ['users'] }) })
  const rows = data.filter((item) => (!search || `${item.nombreCompleto} ${item.correo}`.toLowerCase().includes(search.toLowerCase())) && (!role || item.rol === role) && (!active || String(item.activo) === active))
  return <section className="mx-auto max-w-7xl space-y-6"><div><p className="text-sm font-medium text-primary">Administración</p><h1 className="text-2xl font-semibold">Usuarios</h1><p className="mt-1 text-sm text-slate-500">Consulta, filtra y administra el acceso sin eliminar historial.</p></div><Card className="p-4"><div className="grid gap-3 md:grid-cols-3"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre o correo"/><Select value={role} onChange={(event) => setRole(event.target.value)}><option value="">Todos los roles</option>{USER_ROLES.map((value) => <option key={value}>{value}</option>)}</Select><Select value={active} onChange={(event) => setActive(event.target.value)}><option value="">Todos los estados</option><option value="true">Activos</option><option value="false">Inactivos</option></Select></div></Card><Card className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-4">Usuario</th><th>Rol</th><th>Cargo</th><th>Dependencia</th><th>Último acceso</th><th>Estado</th><th/></tr></thead><tbody>{rows.map((item) => <tr className="border-t" key={item.uid}><td className="p-4"><b>{item.nombreCompleto}</b><small className="block text-slate-500">{item.correo}</small></td><td>{item.rol}</td><td>{item.cargo}</td><td>{(item as typeof item & { dependencia?: string }).dependencia ?? '—'}</td><td>{item.ultimoIngreso?.toDate().toLocaleString('es-CO') ?? 'Sin acceso registrado'}</td><td>{item.activo ? 'Activo' : 'Inactivo'}</td><td><Button variant="outline" size="sm" onClick={() => toggle.mutate({ uid: item.uid, value: !item.activo })}>{item.activo ? 'Desactivar' : 'Activar'}</Button></td></tr>)}</tbody></table></Card></section>
}
