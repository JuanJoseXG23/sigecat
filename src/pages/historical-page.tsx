import { Archive, Download, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState, TableSkeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { matchesExpedientSearch } from '@/features/expedients/expedient-filters'
import { useHistoricalExpedients } from '@/hooks/use-historical-expedients'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import { downloadCsv } from '@/lib/csv'
import { formatDate } from '@/lib/format'
import { getClosingDate, type Expedient } from '@/types/expedient'

interface Row {
  item: Expedient
  closing: Date
}

const responsibleOf = (item: Expedient) =>
  item.funcionarioAsignado?.nombreCompleto ?? item.responsableExterno ?? ''

function exportRows(rows: Row[]) {
  downloadCsv(
    `historico-catastro-${new Date().toISOString().slice(0, 10)}.csv`,
    [
      'Radicado',
      'Fecha de radicado',
      'Tipo de trámite',
      'Asunto',
      'Solicitante',
      'Responsable',
      'Estado',
      'Fecha de cierre',
      'Radicado de salida',
      'Folios',
    ],
    rows.map(({ item, closing }) => [
      item.numeroRadicado,
      formatDate(item.fechaRadicado),
      item.tipoTramite,
      item.asunto,
      item.solicitantes[0]?.nombre,
      responsibleOf(item),
      item.estado,
      formatDate(closing),
      item.numeroRadicadoActuacion,
      (item.documentosWorkflow ?? []).reduce(
        (total, document) => total + (document.folios ?? 0),
        0,
      ) || '',
    ]),
  )
}

export function HistoricalPage() {
  const { data = [], isLoading } = useHistoricalExpedients()
  const { data: types = [] } = useProcedureTypes()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [year, setYear] = useState('')

  const all = useMemo(() => data.map((item) => ({ item, closing: getClosingDate(item) })), [data])
  const years = [...new Set(all.map((row) => row.closing.getFullYear()))].sort((a, b) => b - a)
  const rows = useMemo(
    () =>
      all
        .filter(
          ({ item, closing }) =>
            matchesExpedientSearch(item, search) &&
            (!type || item.tipoTramiteId === type) &&
            (!year || closing.getFullYear() === Number(year)),
        )
        .sort((first, second) => second.closing.getTime() - first.closing.getTime()),
    [all, search, type, year],
  )
  const hasFilters = Boolean(search || type || year)

  return (
    <section className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        kicker="Archivo"
        title="Histórico"
        description="Expedientes finalizados o archivados, disponibles para consulta."
        actions={
          <Button variant="outline" onClick={() => exportRows(rows)} disabled={!rows.length}>
            <Download size={16} /> Exportar a Excel
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Radicado, solicitante, documento o predio"
            aria-label="Buscar en el histórico"
          />
        </div>
        <Select
          className="lg:w-56"
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Tipo de trámite"
        >
          <option value="">Todos los trámites</option>
          {types.map((value) => (
            <option key={value.id} value={value.id}>
              {value.nombre}
            </option>
          ))}
        </Select>
        <Select
          className="lg:w-44"
          value={year}
          onChange={(event) => setYear(event.target.value)}
          aria-label="Año de cierre"
        >
          <option value="">Todos los años</option>
          {years.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setType('')
              setYear('')
            }}
          >
            <X size={16} /> Limpiar
          </Button>
        )}
      </div>

      <div className="table-shell overflow-x-auto">
        <table className="data-table min-w-[820px]">
          <thead>
            <tr>
              <th>Radicado</th>
              <th>Solicitante</th>
              <th>Responsable</th>
              <th>Cierre</th>
              <th>
                <span className="sr-only">Consultar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton columns={5} />}
            {!isLoading &&
              rows.map(({ item, closing }) => (
                <tr key={item.id}>
                  <td>
                    <p className="font-semibold text-slate-900">{item.numeroRadicado}</p>
                    <p className="max-w-60 truncate text-xs text-muted-foreground">
                      {item.tipoTramite ?? 'Sin tipo'}
                      {item.asunto ? ` · ${item.asunto}` : ''}
                    </p>
                  </td>
                  <td className="max-w-56 truncate">{item.solicitantes[0]?.nombre ?? '—'}</td>
                  <td>{responsibleOf(item) || '—'}</td>
                  <td className="whitespace-nowrap">
                    <p>{formatDate(closing)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.estado === 'Archivado' ? 'Archivado' : 'Finalizado'}
                    </p>
                  </td>
                  <td className="text-right">
                    <Link className="link" to={`/expedientes/${item.id}`}>
                      Consultar
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!isLoading && !rows.length && (
          <EmptyState
            icon={Archive}
            title={hasFilters ? 'Nada coincide con los filtros' : 'Aún no hay expedientes cerrados'}
            description={
              hasFilters ? undefined : 'Al finalizar o archivar un expediente aparecerá aquí.'
            }
          />
        )}
        {rows.length > 0 && (
          <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
            {rows.length} expediente{rows.length === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </section>
  )
}
