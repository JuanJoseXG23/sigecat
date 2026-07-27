import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useHistoricalExpedients } from '@/hooks/use-historical-expedients'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import { deleteExpedient } from '@/services/expedient.service'

export function HistoricalPage() {
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const { data = [], isLoading } = useHistoricalExpedients()
  const { data: types = [] } = useProcedureTypes()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [responsible, setResponsible] = useState('')
  const [date, setDate] = useState('')

  const deleteExpedientMutation = useMutation({
    mutationFn: async (expedientId: string) => {
      if (!user) throw new Error('Usuario no autenticado.')
      return deleteExpedient(expedientId)
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['historical-expedients'] }),
        client.invalidateQueries({ queryKey: ['expedients'] }),
        client.invalidateQueries({ queryKey: ['work-tray'] }),
      ])
    },
  })

  const municipalities = [...new Set(data.flatMap((item) => item.predios.map((property) => property.municipio)).filter(Boolean))]
  const rows = useMemo(
    () =>
      data.filter((item) => {
        const text = `${item.numeroRadicado} ${item.solicitantes.map((value) => value.nombre).join(' ')}`.toLowerCase()
        return (
          (!search || text.includes(search.toLowerCase())) &&
          (!type || item.tipoTramiteId === type) &&
          (!municipality || item.predios.some((property) => property.municipio === municipality)) &&
          (!responsible || (item.funcionarioAsignado?.nombreCompleto ?? item.responsableExterno ?? '').toLowerCase().includes(responsible.toLowerCase())) &&
          (!date || item.fechaActualizacion.toDate().toISOString().slice(0, 10) === date)
        )
      }),
    [data, date, municipality, responsible, search, type],
  )

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Consulta documental</p>
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <p className="mt-1 text-sm text-slate-500">Expedientes finalizados, disponibles únicamente para consulta.</p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Radicado o solicitante" />
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos los trámites</option>
            {types.map((value) => (
              <option key={value.id} value={value.id}>
                {value.nombre}
              </option>
            ))}
          </Select>
          <Input value={responsible} onChange={(event) => setResponsible(event.target.value)} placeholder="Responsable" />
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Select value={municipality} onChange={(event) => setMunicipality(event.target.value)}>
            <option value="">Todos los municipios</option>
            {municipalities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-4">Radicado</th>
              <th>Solicitante</th>
              <th>Trámite</th>
              <th>Responsable</th>
              <th>Fecha de cierre</th>
              <th>Municipio</th>
              {profile?.rol === 'Administrador' && <th />}
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="p-6" colSpan={profile?.rol === 'Administrador' ? 8 : 7}>
                  Cargando…
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr className="border-t" key={item.id}>
                  <td className="p-4 font-medium">{item.numeroRadicado}</td>
                  <td>{item.solicitantes[0]?.nombre ?? '—'}</td>
                  <td>{item.tipoTramite ?? '—'}</td>
                  <td>{item.funcionarioAsignado?.nombreCompleto ?? item.responsableExterno ?? '—'}</td>
                  <td>{item.fechaActualizacion.toDate().toLocaleDateString('es-CO')}</td>
                  <td>{item.predios[0]?.municipio ?? '—'}</td>
                  <td>
                    <Link className="text-primary hover:underline" to={`/expedientes/${item.id}`}>
                      Consultar
                    </Link>
                  </td>
                  {profile?.rol === 'Administrador' ? (
                    <td className="pr-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Eliminar permanentemente el expediente ${item.numeroRadicado}? Esta acción no se puede deshacer.`,
                            )
                          ) {
                            deleteExpedientMutation.mutate(item.id)
                          }
                        }}
                        disabled={deleteExpedientMutation.isPending}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </section>
  )
}
