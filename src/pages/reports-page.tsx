import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { downloadCsv } from '@/lib/csv'
import { formatDate } from '@/lib/format'
import { listExpedients, listHistoricalExpedients } from '@/services/expedient.service'
import { getClosingDate, type Expedient } from '@/types/expedient'

function group(items: Expedient[], label: (item: Expedient) => string): [string, number][] {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(label(item), (counts.get(label(item)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

const responsibleOf = (item: Expedient) =>
  item.funcionarioAsignado?.nombreCompleto ?? item.responsableExterno ?? 'Sin asignar'

/** Cerrado a tiempo: la fecha de cierre no supera la fecha límite (incluida la ampliación). */
function closedOnTime(item: Expedient): boolean | null {
  if (item.activo || !item.fechaLimite || item.estado === 'Archivado') return null
  const deadline = item.fechaLimite.toDate()
  deadline.setHours(23, 59, 59, 999)
  return getClosingDate(item) <= deadline
}

function BarList({
  title,
  values,
  total,
}: {
  title: string
  values: [string, number][]
  total: number
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {values.length ? (
        <ul className="mt-4 space-y-3">
          {values.slice(0, 8).map(([label, count]) => (
            <li key={label} title={`${label}: ${count} expediente${count === 1 ? '' : 's'}`}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate text-slate-700">{label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                  {count}
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({Math.round((count * 100) / Math.max(1, total))}%)
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-r bg-primary"
                  style={{ width: `${Math.max(2, (count * 100) / Math.max(1, values[0][1]))}%` }}
                />
              </div>
            </li>
          ))}
          {values.length > 8 && (
            <li className="text-xs text-muted-foreground">
              Y {values.length - 8} más con menos expedientes.
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Sin datos para los filtros.</p>
      )}
    </section>
  )
}

export function ReportsPage() {
  const active = useQuery({ queryKey: ['expedients'], queryFn: () => listExpedients() })
  const closed = useQuery({
    queryKey: ['historical-expedients'],
    queryFn: listHistoricalExpedients,
  })
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const all = useMemo(
    () => [...(active.data ?? []), ...(closed.data ?? [])],
    [active.data, closed.data],
  )
  const years = [...new Set(all.map((item) => item.fechaRadicado.toDate().getFullYear()))].sort(
    (a, b) => b - a,
  )
  const rows = useMemo(
    () =>
      all.filter(
        (item) =>
          (!year || item.fechaRadicado.toDate().getFullYear() === Number(year)) &&
          (!status || item.estado === status) &&
          (!type || item.tipoTramite === type),
      ),
    [all, status, type, year],
  )
  const evaluated = rows.map(closedOnTime).filter((value) => value !== null)
  const onTime = evaluated.filter(Boolean).length
  const timeliness = evaluated.length ? Math.round((onTime * 100) / evaluated.length) : null

  const kpis: { label: string; value: string | number; hint?: string }[] = [
    { label: 'Radicados', value: rows.length },
    { label: 'Activos', value: rows.filter((item) => item.activo).length },
    { label: 'Cerrados', value: rows.filter((item) => !item.activo).length },
    {
      label: 'Vencidos hoy',
      value: rows.filter((item) => item.activo && item.estadoTermino === 'Vencido').length,
    },
    {
      label: 'Con ampliación',
      value: rows.filter((item) => item.diasAmpliacion).length,
    },
    {
      label: 'Respuesta oportuna',
      value: timeliness === null ? '—' : `${timeliness}%`,
      hint: evaluated.length ? `${onTime} de ${evaluated.length} cerrados a tiempo` : undefined,
    },
  ]

  const exportExcel = () =>
    downloadCsv(
      `reporte-sigecat-${year || 'todos'}.csv`,
      [
        'Radicado',
        'Fecha radicado',
        'Tipo de trámite',
        'Estado',
        'Responsable',
        'Fecha límite',
        'Días ampliados',
        'Fecha de cierre',
        'Respondido a tiempo',
        'Municipio',
      ],
      rows.map((item) => {
        const timely = closedOnTime(item)
        return [
          item.numeroRadicado,
          formatDate(item.fechaRadicado),
          item.tipoTramite,
          item.estado,
          responsibleOf(item),
          formatDate(item.fechaLimite),
          item.diasAmpliacion ?? 0,
          item.activo ? '' : formatDate(getClosingDate(item)),
          timely === null ? '' : timely ? 'Sí' : 'No',
          item.predios[0]?.municipio,
        ]
      }),
    )

  return (
    <section className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        kicker="Análisis"
        title="Reportes"
        description="Indicadores de gestión de los expedientes radicados en el periodo."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir / PDF
            </Button>
            <Button onClick={exportExcel} disabled={!rows.length}>
              <Download size={16} /> Excel
            </Button>
          </>
        }
      />
      <div className="no-print grid gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:grid-cols-3">
        <Select
          value={year}
          onChange={(event) => setYear(event.target.value)}
          aria-label="Año de radicación"
        >
          <option value="">Todos los años</option>
          {years.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          {[...new Set(all.map((item) => item.estado))].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Tipo de trámite"
        >
          <option value="">Todos los trámites</option>
          {[...new Set(all.map((item) => item.tipoTramite).filter(Boolean))].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {active.isLoading || closed.isLoading ? '–' : kpi.value}
            </p>
            {kpi.hint && <p className="mt-0.5 text-xs text-muted-foreground">{kpi.hint}</p>}
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <BarList
          title="Por estado"
          values={group(rows, (item) => item.estado)}
          total={rows.length}
        />
        <BarList
          title="Por tipo de trámite"
          values={group(rows, (item) => item.tipoTramite ?? 'Sin tipo')}
          total={rows.length}
        />
        <BarList
          title="Carga por responsable (activos)"
          values={group(
            rows.filter((item) => item.activo),
            responsibleOf,
          )}
          total={rows.filter((item) => item.activo).length}
        />
        <BarList
          title="Por medio de ingreso"
          values={group(rows, (item) => item.medioIngreso || 'No registrado')}
          total={rows.length}
        />
      </div>
    </section>
  )
}
