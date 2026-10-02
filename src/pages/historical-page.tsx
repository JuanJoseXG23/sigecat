import { Archive, Download, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
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
import { getRetentionStatus, type RetentionPhase } from '@/lib/retention'
import { getClosingDate, type Expedient } from '@/types/expedient'

const phaseVariants: Record<RetentionPhase, BadgeVariant> = {
  'Sin TRD': 'default',
  'En archivo de gestión': 'brand',
  'Listo para transferencia': 'warning',
  'Aplicar disposición final': 'destructive',
}

interface Row {
  item: Expedient
  closing: Date
  retention: ReturnType<typeof getRetentionStatus>
}

function toRow(item: Expedient): Row {
  const closing = getClosingDate(item)
  const classification = item.clasificacionDocumental
  return {
    item,
    closing,
    retention: getRetentionStatus(
      closing,
      classification?.retencionGestion,
      classification?.retencionCentral,
    ),
  }
}

/** Inventario en el orden del Formato Único de Inventario Documental (Acuerdo 042 de 2002). */
function exportInventory(rows: Row[]) {
  downloadCsv(
    `inventario-documental-catastro-${new Date().toISOString().slice(0, 10)}.csv`,
    [
      'N.º de orden',
      'Código TRD',
      'Serie / subserie / asunto',
      'Fecha inicial',
      'Fecha final',
      'N.º de folios',
      'Soporte',
      'Nivel de acceso',
      'Fase de retención',
      'Disposición final',
      'Notas',
    ],
    rows.map(({ item, closing, retention }, index) => {
      const classification = item.clasificacionDocumental
      const folios = (item.documentosWorkflow ?? []).reduce(
        (total, document) => total + (document.folios ?? 0),
        0,
      )
      return [
        index + 1,
        classification?.codigo,
        [
          classification?.serie,
          classification?.subserie,
          `Radicado ${item.numeroRadicado}${item.asunto ? ` · ${item.asunto}` : ''} · ${item.solicitantes[0]?.nombre ?? ''}`,
        ]
          .filter(Boolean)
          .join(' / '),
        formatDate(item.fechaRadicado),
        formatDate(closing),
        folios || '',
        'Electrónico (OneDrive)',
        item.nivelAcceso,
        retention.phase,
        classification?.disposicionFinal,
        item.estado === 'Archivado' ? 'Archivado fuera del flujo' : '',
      ]
    }),
  )
}

export function HistoricalPage() {
  const { data = [], isLoading } = useHistoricalExpedients()
  const { data: types = [] } = useProcedureTypes()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [year, setYear] = useState('')
  const [phase, setPhase] = useState('')

  const all = useMemo(() => data.map(toRow), [data])
  const years = [...new Set(all.map((row) => row.closing.getFullYear()))].sort((a, b) => b - a)
  const rows = useMemo(
    () =>
      all
        .filter(
          ({ item, closing, retention }) =>
            matchesExpedientSearch(item, search) &&
            (!type || item.tipoTramiteId === type) &&
            (!year || closing.getFullYear() === Number(year)) &&
            (!phase || retention.phase === phase),
        )
        .sort((first, second) => second.closing.getTime() - first.closing.getTime()),
    [all, phase, search, type, year],
  )
  const readyToTransfer = all.filter((row) => row.retention.phase === 'Listo para transferencia')
  const hasFilters = Boolean(search || type || year || phase)

  return (
    <section className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        kicker="Archivo"
        title="Histórico y retención"
        description="Expedientes cerrados en modo consulta, con su fase según la Tabla de Retención Documental."
        actions={
          <Button variant="outline" onClick={() => exportInventory(rows)} disabled={!rows.length}>
            <Download size={16} /> Inventario (FUID)
          </Button>
        }
      />

      {readyToTransfer.length > 0 && (
        <button
          type="button"
          onClick={() => setPhase(phase ? '' : 'Listo para transferencia')}
          className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 transition hover:bg-amber-100"
        >
          <Archive size={18} className="shrink-0" />
          <span>
            {readyToTransfer.length === 1 ? (
              <>
                <b>1</b> expediente cumplió su tiempo en el archivo de gestión y está listo
              </>
            ) : (
              <>
                <b>{readyToTransfer.length}</b> expedientes cumplieron su tiempo en el archivo de
                gestión y están listos
              </>
            )}{' '}
            para la transferencia primaria al archivo central.{' '}
            <span className="font-semibold underline">{phase ? 'Ver todos' : 'Ver solo esos'}</span>
          </span>
        </button>
      )}

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
          className="lg:w-40"
          value={year}
          onChange={(event) => setYear(event.target.value)}
          aria-label="Año de cierre"
        >
          <option value="">Todos los años</option>
          {years.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select
          className="lg:w-56"
          value={phase}
          onChange={(event) => setPhase(event.target.value)}
          aria-label="Fase de retención"
        >
          <option value="">Toda fase de retención</option>
          {Object.keys(phaseVariants).map((value) => (
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
              setPhase('')
            }}
          >
            <X size={16} /> Limpiar
          </Button>
        )}
      </div>

      <div className="table-shell overflow-x-auto">
        <table className="data-table min-w-[980px]">
          <thead>
            <tr>
              <th>Radicado</th>
              <th>Solicitante</th>
              <th>Cierre</th>
              <th>Serie documental</th>
              <th>Retención</th>
              <th>Disposición final</th>
              <th>
                <span className="sr-only">Consultar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton columns={7} />}
            {!isLoading &&
              rows.map(({ item, closing, retention }) => (
                <tr key={item.id}>
                  <td>
                    <p className="font-semibold text-slate-900">{item.numeroRadicado}</p>
                    <p className="max-w-52 truncate text-xs text-muted-foreground">
                      {item.tipoTramite ?? 'Sin tipo'}
                    </p>
                  </td>
                  <td className="max-w-48 truncate">{item.solicitantes[0]?.nombre ?? '—'}</td>
                  <td className="whitespace-nowrap">
                    <p>{formatDate(closing)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.estado === 'Archivado' ? 'Archivado' : 'Finalizado'}
                    </p>
                  </td>
                  <td>
                    {item.clasificacionDocumental?.serie ? (
                      <>
                        <p className="max-w-48 truncate">{item.clasificacionDocumental.serie}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.clasificacionDocumental.codigo ?? ''}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin clasificar</span>
                    )}
                  </td>
                  <td>
                    <Badge variant={phaseVariants[retention.phase]}>{retention.phase}</Badge>
                    {retention.transferDate && retention.phase === 'En archivo de gestión' && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Transferir desde {formatDate(retention.transferDate)}
                      </p>
                    )}
                  </td>
                  <td>{item.clasificacionDocumental?.disposicionFinal ?? '—'}</td>
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
