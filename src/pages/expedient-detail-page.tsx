import { useParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { useExpedients } from '@/hooks/use-expedients'
import { Badge } from '@/components/ui/badge'

export function ExpedientDetailPage() {
  const { id } = useParams(); const { data = [] } = useExpedients(); const item = data.find((expedient) => expedient.id === id)
  if (!item) return <p className="text-sm text-slate-500">Cargando expediente…</p>
  return <section className="mx-auto max-w-6xl space-y-6"><div><p className="text-sm font-medium text-primary">Expediente {item.numeroRadicado}</p><h1 className="text-2xl font-semibold">Detalle del expediente</h1></div><div className="flex flex-wrap gap-2"><Badge variant="info">{item.estado}</Badge><Badge>{item.prioridad ?? 'Sin prioridad'}</Badge><Badge>{item.tipoTramite ?? 'Sin tipo de trámite'}</Badge><Badge>{item.funcionarioAsignado?.nombreCompleto ?? 'Sin asignar'}</Badge></div><div className="grid gap-4 md:grid-cols-2"><Card className="p-5"><h2 className="font-semibold">Resumen</h2><p className="mt-3 text-sm">Radicado: {item.numeroRadicado}</p><p className="text-sm">Medio de ingreso: {item.medioIngreso ?? '—'}</p><p className="text-sm">Observaciones: {item.observacionesIniciales ?? '—'}</p></Card><Card className="p-5"><h2 className="font-semibold">Solicitantes</h2>{item.solicitantes.map((applicant,index)=><p key={index} className="mt-2 text-sm">{applicant.nombre || 'Sin nombre'} · {applicant.documento || 'Sin documento'}</p>)}</Card><Card className="p-5"><h2 className="font-semibold">Predios</h2>{item.predios.map((property,index)=><p key={index} className="mt-2 text-sm">{property.municipio || '—'} · {property.direccion || 'Sin dirección'}</p>)}</Card><Card className="p-5"><h2 className="font-semibold">Observaciones · Historial · Documentos</h2><p className="mt-2 text-sm text-slate-500">Estas secciones quedan disponibles para sus subcolecciones y documentos en Storage.</p></Card></div></section>
}
