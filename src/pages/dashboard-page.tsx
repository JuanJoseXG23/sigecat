import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquare,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import { useWorkTray } from '@/hooks/use-work-tray'
import { EXPEDIENT_PRIORITIES, EXPEDIENT_STATUSES, type ExpedientPriority } from '@/types/expedient'

function priorityVariant(priority?: ExpedientPriority) {
  return priority === 'Alta' ? 'destructive' : priority === 'Media' ? 'warning' : 'success'
}
function initials(name?: string) {
  return (
    name
      ?.split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  )
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
  const municipalities = [
    ...new Set(data.map((item) => item.predios[0]?.municipio).filter(Boolean)),
  ]
  const rows = useMemo(
    () =>
      data.filter(
        (item) =>
          (!status || item.estado === status) &&
          (!municipality || item.predios.some((property) => property.municipio === municipality)) &&
          (!official || item.funcionarioAsignado?.uid === official) &&
          (!type || item.tipoTramiteId === type) &&
          (!priority || item.prioridad === priority),
      ),
    [data, municipality, official, priority, status, type],
  )
  const metrics = [
    [
      'Vencidos',
      rows.filter((item) => item.estadoTermino === 'Vencido').length,
      CheckCircle2,
      'emerald',
    ],
    [
      'Próximos a vencer',
      rows.filter((item) => item.estadoTermino === 'Próximo a vencer').length,
      CalendarDays,
      'amber',
    ],
    [
      'Pendientes de visita',
      rows.filter((item) => item.estado === 'Pendiente de Visita').length,
      UserRound,
      'sky',
    ],
    [
      'Pendientes de respuesta',
      rows.filter(
        (item) => item.estado.includes('respuesta') || item.estado === 'Pendiente de Información',
      ).length,
      MessageSquare,
      'violet',
    ],
  ] as const
  return (
    <section className="mx-auto max-w-[1440px] space-y-6">
      <header>
        <p className="text-sm text-slate-500">
          Inicio <span className="mx-1 text-slate-300">/</span> Dashboard
        </p>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Bienvenido, {profile?.nombreCompleto ?? 'funcionario'} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestiona y prioriza tus expedientes de manera eficiente.
        </p>
      </header>
      <Card className="border-slate-200 p-4 shadow-sm">
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, count, Icon, tone]) => (
          <Card key={label} className="relative overflow-hidden border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div
                className={`grid size-12 place-items-center rounded-full bg-${tone}-100 text-${tone}-600`}
              >
                <Icon size={22} />
              </div>
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
              </div>
            </div>
            <div className={`absolute inset-x-4 bottom-0 h-1 bg-${tone}-500`} />
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Expedientes{' '}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                {rows.length} resultados
              </span>
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Radicado</th>
                <th className="px-4 py-4">Solicitante</th>
                <th className="px-4 py-4">Trámite</th>
                <th className="px-4 py-4">Estado</th>
                <th className="px-4 py-4">Prioridad</th>
                <th className="px-4 py-4">Fecha límite</th>
                <th className="px-4 py-4">Responsable</th>
                <th className="px-5 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    Cargando expedientes…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    No hay expedientes con los filtros seleccionados.
                  </td>
                </tr>
              )}
              {rows.map((item) => {
                const responsible =
                  item.funcionarioAsignado?.nombreCompleto ??
                  item.responsableExterno ??
                  'Sin asignar'
                return (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-500">
                          <FileText size={17} />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{item.numeroRadicado}</p>
                          <p className="text-xs text-slate-500">
                            {item.medioIngreso ?? 'Radicado de entrada'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-800">
                      {item.solicitantes[0]?.nombre ?? '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700">
                        {item.tipoTramite ?? 'Sin tipo'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={item.estadoTermino === 'Vencido' ? 'destructive' : 'success'}>
                        {item.estado}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={priorityVariant(item.prioridad)}>
                        {item.prioridad ?? 'Sin prioridad'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <Clock3 size={16} className="mt-0.5 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-800">
                            {item.fechaLimite?.toDate().toLocaleDateString('es-CO') ?? '—'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.diasRestantes ?? '—'} días restantes
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                          {initials(responsible)}
                        </span>
                        <span className="max-w-32 truncate font-medium text-slate-700">
                          {responsible}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/expedientes/${item.id}`}
                        className="inline-flex rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
