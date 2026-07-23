import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { useWorkTray } from '@/hooks/use-work-tray'

const metrics = (items: { estado: string; fechaLimite?: { toDate: () => Date } }[]) => [
  ['Expedientes activos', items.length], ['En estudio', items.filter(i => i.estado === 'En Estudio').length], ['Pendientes', items.filter(i => i.estado.startsWith('Pendiente')).length], ['Vencidos', items.filter(i => i.fechaLimite && i.fechaLimite.toDate() < new Date()).length], ['Finalizados', items.filter(i => i.estado === 'Finalizado').length],
]

export function DashboardPage() {
  const { user, profile } = useAuth(); const { data = [], isLoading } = useWorkTray(profile?.rol, user?.uid)
  return <section className="mx-auto max-w-7xl space-y-6"><div><p className="text-sm font-medium text-primary">Centro de trabajo</p><h1 className="text-2xl font-semibold">Mi bandeja</h1></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{metrics(data).map(([label,value])=><Card key={label} className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></Card>)}</div><Card className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-4">Radicado</th><th>Solicitante</th><th>Trámite</th><th>Estado</th><th>Prioridad</th><th>Fecha límite</th><th>Responsable</th><th/></tr></thead><tbody>{isLoading?<tr><td colSpan={8} className="p-8">Cargando…</td></tr>:data.map(item=><tr key={item.id} className="border-t"><td className="p-4 font-medium">{item.numeroRadicado}</td><td>{item.solicitantes[0]?.nombre ?? '—'}</td><td>{item.tipoTramite ?? '—'}</td><td><Badge variant="info">{item.estado}</Badge></td><td>{item.prioridad ?? '—'}</td><td>{item.fechaLimite?.toDate().toLocaleDateString('es-CO') ?? '—'}</td><td>{item.funcionarioAsignado?.nombreCompleto ?? 'Sin asignar'}</td><td><Button size="sm" variant="outline" asChild><Link to={`/expedientes/${item.id}`}>Abrir</Link></Button></td></tr>)}</tbody></table></Card></section>
}
