import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import { useWorkTray } from '@/hooks/use-work-tray'
import { EXPEDIENT_PRIORITIES, EXPEDIENT_STATUSES } from '@/types/expedient'
import { CalendarDays, User2, File, Clock } from 'lucide-react'

function getStatusVariant(estado: string) {
  if (estado === 'Vencido' || estado.includes('Vencido')) return 'destructive'
  if (estado.includes('Pendiente') || estado.includes('En respuesta') || estado.includes('Traslado')) return 'warning'
  return 'info'
}

function getPriorityVariant(priority?: string) {
  if (priority === 'Alta') return 'destructive'
  if (priority === 'Media') return 'warning'
  return 'success'
}

function getInitials(name?: string) {
  if (!name) return 'NA'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return 'NA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function DashboardPage() {
  const { user, profile } = useAuth()
  const { data = [], isLoading } = useWorkTray(profile?.rol, user?.uid)
  const { data: officials = [] } = useAssignableOfficials()
  const { data: procedureTypes = [] } = useProcedureTypes()
  const [status, setStatus] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [official, setOfficial] = useState('')
  const [type, setType] = useState('')
  const [priority, setPriority] = useState('')


  const municipalities = [...new Set(data.map((item) => item.predios[0]?.municipio).filter(Boolean))]
  const rows = useMemo(
    () =>
      data.filter(
        (item) =>
          (!status || item.estado === status) &&
          (!municipality || item.predios.some((property) => property.municipio === municipality)) &&
          (!official || item.funcionarioAsignado?.uid === official) &&
          (!type || item.tipoTramiteId === type) &&
          (!priority || item.prioridad === priority)
      ),
    [data, municipality, official, priority, status, type]
  )

  const sections = [
    ['Vencidos', rows.filter((item) => item.estadoTermino === 'Vencido')],
    ['Próximos a vencer', rows.filter((item) => item.estadoTermino === 'Próximo a vencer')],
    ['Pendientes de visita', rows.filter((item) => item.estado === 'Pendiente de Visita')],
    ['Pendientes de respuesta', rows.filter((item) => item.estado === 'Pendiente de Información')],
  ] as const

  const rowCards = rows.map((item) => {
    const responsibleName = item.funcionarioAsignado?.nombreCompleto ?? item.responsableExterno ?? 'Sin asignar'
    const priorityLabel = item.prioridad ? `Prioridad ${item.prioridad}` : 'Sin prioridad'

    return (
      <Card
        key={item.id}
        className="group overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-50 p-2">
                <File className="h-5 w-5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Radicado</p>
                <p className="text-2xl font-semibold tracking-tight text-slate-900 truncate">{item.numeroRadicado}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-500">{item.tipoTramite ?? 'Trámite no definido'}</p>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <User2 className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Solicitante</p>
                  <p className="text-sm font-semibold text-slate-800">{item.solicitantes[0]?.nombre ?? '—'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Link
              to={`/expedientes/${item.id}`}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Abrir expediente →
            </Link>
          </div>
        </div>

        <hr className="my-5 border-t border-slate-100" />

        {/* Badges */}
        <div className="flex flex-wrap gap-3">
          <Badge variant={getStatusVariant(item.estado)} className="uppercase rounded-full px-3 py-1 text-[12px] font-semibold">
            {item.estado}
          </Badge>
          <Badge variant={getPriorityVariant(item.prioridad)} className="uppercase rounded-full px-3 py-1 text-[12px] font-semibold">
            {priorityLabel}
          </Badge>
        </div>

        {/* Inner cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white p-2 text-slate-800 shadow-sm">
                <CalendarDays className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Fecha límite</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{item.fechaLimite?.toDate().toLocaleDateString('es-CO') ?? '—'}</p>
                <p className="text-sm text-slate-500">{item.estadoTermino === 'Vencido' ? `${item.diasVencidos ?? 0} días vencido` : item.estadoTermino ? `${item.diasRestantes ?? 0} días restantes` : 'Sin fecha límite'}</p>
                <div className="mt-3">
                  <Badge variant={item.estadoTermino === 'Vencido' ? 'destructive' : item.estadoTermino === 'Próximo a vencer' ? 'warning' : 'success'} className="uppercase rounded-full px-3 py-1 text-[10px] font-semibold">
                    {item.estadoTermino ?? 'Sin plazo'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                {getInitials(responsibleName)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{responsibleName}</p>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Responsable</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t pt-4 text-sm text-slate-500 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>Recibido: {item.fechaRecibido?.toDate().toLocaleDateString('es-CO') ?? '—'}</span>
        </div>
      </Card>
    )
  })

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Centro de trabajo</p>
        <h1 className="text-2xl font-semibold">Mi bandeja</h1>
        <p className="mt-1 text-sm text-slate-500">Prioriza y gestiona expedientes sin cambiar de pantalla.</p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos los estados</option>
            {EXPEDIENT_STATUSES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>

          <Select value={municipality} onChange={(event) => setMunicipality(event.target.value)}>
            <option value="">Todos los municipios</option>
            {municipalities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>

          <Select value={official} onChange={(event) => setOfficial(event.target.value)}>
            <option value="">Todos los funcionarios</option>
            {officials.map((value) => (
              <option key={value.uid} value={value.uid}>
                {value.nombreCompleto}
              </option>
            ))}
          </Select>

          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos los trámites</option>
            {procedureTypes.map((value) => (
              <option key={value.id} value={value.id}>
                {value.nombre}
              </option>
            ))}
          </Select>

          <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">Toda prioridad</option>
            {EXPEDIENT_PRIORITIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map(([label, items]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{items.length}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Cargando…
          </div>
        ) : (
          rowCards
        )}
      </div>
    </section>
  )
}
