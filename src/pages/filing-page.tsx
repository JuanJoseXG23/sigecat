import { useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, Pencil, Search, Stamp, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, TableSkeleton } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { EditFilingDialog } from '@/features/expedients/components/correction-dialogs'
import { useAuth } from '@/hooks/use-auth'
import { downloadCsv } from '@/lib/csv'
import { formatDate, normalizeSearch } from '@/lib/format'
import { canCorrectRecords } from '@/lib/permissions'
import { listFilings, type FilingRecord } from '@/services/filing.service'

const typeVariants: Record<string, BadgeVariant> = {
  Salida: 'success',
  Traslado: 'violet',
  'Ampliación de plazo': 'warning',
}

const monthFormat = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })

function expedientLabel(item: FilingRecord): string {
  return item.expedienteRadicado ?? item.expedienteId.slice(0, 8)
}

export function FilingPage() {
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ['filings'], queryFn: listFilings })
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [month, setMonth] = useState('')
  const [editing, setEditing] = useState<FilingRecord | null>(null)
  const { profile } = useAuth()
  const canCorrect = canCorrectRecords(profile)
  const types = [...new Set(data.map((item) => item.tipo))]
  const months = [...new Set(data.map((item) => item.fecha.slice(0, 7)))].sort().reverse()
  const rows = useMemo(() => {
    const normalized = normalizeSearch(search)
    return data.filter(
      (item) =>
        (!normalized ||
          [item.numero, item.solicitante, expedientLabel(item), item.responsable].some((value) =>
            normalizeSearch(value ?? '').includes(normalized),
          )) &&
        (!type || item.tipo === type) &&
        (!month || item.fecha.startsWith(month)),
    )
  }, [data, month, search, type])

  const exportRows = () =>
    downloadCsv(
      `radicados-catastro-${month || 'todos'}.csv`,
      [
        'Radicado',
        'Fecha',
        'Tipo',
        'Expediente',
        'Solicitante',
        'Responsable',
        'Estado',
        'Soporte',
      ],
      rows.map((item) => [
        item.numero,
        item.fecha,
        item.tipo,
        expedientLabel(item),
        item.solicitante,
        item.responsable,
        item.estado,
        item.documentoUrl,
      ]),
    )

  return (
    <section className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        kicker="Gestión documental"
        title="Radicación"
        description="Libro de radicados de salida, traslado y ampliación de plazo generados en el flujo de cada expediente."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={!rows.length}>
            <Download size={16} /> Exportar a Excel
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Número, solicitante, expediente o responsable"
            aria-label="Buscar radicados"
          />
        </div>
        <Select
          className="md:w-52"
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Tipo"
        >
          <option value="">Todos los tipos</option>
          {types.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
        <Select
          className="md:w-52"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          aria-label="Mes"
        >
          <option value="">Todos los meses</option>
          {months.map((value) => (
            <option key={value} value={value}>
              {monthFormat.format(new Date(`${value}-01T00:00:00`))}
            </option>
          ))}
        </Select>
        {(search || type || month) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setType('')
              setMonth('')
            }}
          >
            <X size={16} /> Limpiar
          </Button>
        )}
      </div>

      <div className="table-shell overflow-x-auto">
        <table className="data-table min-w-[960px]">
          <thead>
            <tr>
              <th>Radicado</th>
              <th>Tipo</th>
              <th>Expediente</th>
              <th>Solicitante</th>
              <th>Responsable</th>
              <th>Soporte</th>
              {canCorrect && (
                <th>
                  <span className="sr-only">Corregir</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton columns={canCorrect ? 7 : 6} />}
            {rows.map((item) => (
              <tr key={item.id}>
                <td>
                  <p className="font-semibold text-slate-900">{item.numero}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.fecha)}</p>
                </td>
                <td>
                  <Badge variant={typeVariants[item.tipo] ?? 'default'}>{item.tipo}</Badge>
                </td>
                <td>
                  <Link className="link" to={`/expedientes/${item.expedienteId}`}>
                    {expedientLabel(item)}
                  </Link>
                  <p className="text-xs text-muted-foreground">{item.estado}</p>
                </td>
                <td className="max-w-48 truncate">{item.solicitante || '—'}</td>
                <td>{item.responsable || 'Sin asignar'}</td>
                <td>
                  {item.documentoUrl ? (
                    <a
                      href={item.documentoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link inline-flex max-w-48 items-center gap-1"
                    >
                      <span className="truncate">{item.documentoNombre || 'Abrir escaneo'}</span>
                      <ExternalLink size={13} className="shrink-0" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Sin soporte</span>
                  )}
                </td>
                {canCorrect && (
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(item)}
                      aria-label={`Corregir el radicado ${item.numero}`}
                      title="Corregir radicado"
                    >
                      <Pencil size={15} />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {isError && (
          <p className="px-5 py-10 text-center text-sm text-destructive">
            No fue posible cargar los radicados.
          </p>
        )}
        {!isLoading && !isError && !rows.length && (
          <EmptyState
            icon={Stamp}
            title="No hay radicados para mostrar"
            description="Los radicados se registran al completar los pasos del flujo de un expediente."
          />
        )}
      </div>
      {editing && <EditFilingDialog filing={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
