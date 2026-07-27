import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FileText, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { deleteFiling, listFilings } from '@/services/filing.service'

const JUAN_JOSE_UID = 'AwFgpoMeCgQ0FyZ4R4gHIv2LlyC2'

export function FilingPage() {
  const { user } = useAuth()
  const client = useQueryClient()
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ['filings'], queryFn: listFilings })
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [municipality, setMunicipality] = useState('')
  const canDelete = user?.uid === JUAN_JOSE_UID
  const remove = useMutation({
    mutationFn: deleteFiling,
    onSuccess: () => client.invalidateQueries({ queryKey: ['filings'] }),
  })
  const municipalities = [...new Set(data.map((item) => item.municipio).filter(Boolean))]
  const rows = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('es-CO')
    return data.filter(
      (item) =>
        (!normalized ||
          [item.numero, item.solicitante, item.expedienteId, item.responsable].some((value) =>
            value.toLocaleLowerCase('es-CO').includes(normalized),
          )) &&
        (!type || item.tipo === type) &&
        (!municipality || item.municipio === municipality),
    )
  }, [data, municipality, search, type])

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Gestión documental</p>
        <h1 className="text-2xl font-semibold">Radicación</h1>
        <p className="mt-1 text-sm text-slate-500">
          Consulta los radicados de entrada, salida y traslado vinculados a cada expediente.
        </p>
      </div>
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Número, solicitante, expediente o responsable"
          />
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos los tipos</option>
            {[...new Set(data.map((item) => item.tipo))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <Select value={municipality} onChange={(event) => setMunicipality(event.target.value)}>
            <option value="">Todos los municipios</option>
            {municipalities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </div>
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-4">Radicado</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Expediente</th>
              <th>Solicitante</th>
              <th>Responsable</th>
              <th>Estado</th>
              <th>Soporte</th>
              {canDelete && <th />}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={canDelete ? 9 : 8}>
                  Cargando radicados…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td className="p-8 text-center text-destructive" colSpan={canDelete ? 9 : 8}>
                  No fue posible cargar los radicados.
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td className="p-10 text-center text-slate-500" colSpan={canDelete ? 9 : 8}>
                  <FileText className="mx-auto mb-2 text-slate-400" />
                  No hay radicados con los filtros seleccionados.
                </td>
              </tr>
            )}
            {rows.map((item) => (
              <tr className="border-t border-slate-100 hover:bg-slate-50" key={item.id}>
                <td className="p-4 font-semibold text-slate-900">{item.numero}</td>
                <td>{item.fecha}</td>
                <td>{item.tipo}</td>
                <td>
                  <Link
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    to={`/expedientes/${item.expedienteId}`}
                  >
                    {item.expedienteId.slice(0, 8)}
                    <ExternalLink size={13} />
                  </Link>
                </td>
                <td>{item.solicitante || '—'}</td>
                <td>{item.responsable || 'Sin asignar'}</td>
                <td>{item.estado}</td>
                <td>
                  {item.documentoUrl ? (
                    <a
                      href={item.documentoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      {item.documentoNombre || 'Abrir escaneo'}
                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <span className="text-slate-400">Sin soporte</span>
                  )}
                </td>
                {canDelete && (
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Eliminar radicado ${item.numero}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar permanentemente el radicado ${item.numero}?`))
                          remove.mutate(item.id)
                      }}
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  )
}
