import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp, Edit3, ExternalLink, FilePlus2, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ExpedientForm } from '@/features/expedients/components/expedient-form'
import { useAuth } from '@/hooks/use-auth'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useExpedients } from '@/hooks/use-expedients'
import { getRemainingBusinessDays } from '@/lib/expedient-deadline'
import { archiveExpedient, createExpedient, updateExpedient } from '@/services/expedient.service'
import type { Expedient, ExpedientFormData, ExpedientPriority } from '@/types/expedient'
import { EXPEDIENT_PRIORITIES, EXPEDIENT_STATUSES } from '@/types/expedient'

const PAGE_SIZE = 10

function formatDate(value?: { toDate: () => Date }): string {
  return value
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(value.toDate())
    : '—'
}

function priorityVariant(
  priority?: ExpedientPriority,
): 'destructive' | 'warning' | 'success' | 'default' {
  if (priority === 'Alta') return 'destructive'
  if (priority === 'Media') return 'warning'
  if (priority === 'Baja') return 'success'
  return 'default'
}

export function ExpedientsPage() {
  const { user, hasRole } = useAuth()
  const queryClient = useQueryClient()
  const { data: expedients = [], isLoading, isError } = useExpedients()
  const { data: officials = [] } = useAssignableOfficials()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [sortDescending, setSortDescending] = useState(true)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [selectedExpedient, setSelectedExpedient] = useState<Expedient | undefined>()
  const canManage = hasRole(['Administrador', 'Coordinador', 'Funcionario'])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['expedients'] })
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ExpedientFormData) => {
      const official = officials.find((item) => item.uid === values.funcionarioAsignadoUid)
      const assignedOfficial = official
        ? { uid: official.uid, nombreCompleto: official.nombreCompleto }
        : selectedExpedient?.funcionarioAsignado
      if (selectedExpedient) {
        await updateExpedient(selectedExpedient.id, values, user!.uid, assignedOfficial)
      } else if (user) {
        await createExpedient(values, user.uid, assignedOfficial)
      }
    },
    onSuccess: async () => {
      await refresh()
      setFormOpen(false)
      setSelectedExpedient(undefined)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveExpedient(id, user!.uid),
    onSuccess: refresh,
  })

  const filteredExpedients = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es-CO')
    return expedients
      .filter((item) => {
        const firstApplicant = item.solicitantes[0]?.nombre ?? ''
        const matchesSearch =
          !normalizedSearch ||
          [item.numeroRadicado, firstApplicant, item.tipoTramite ?? ''].some((value) =>
            value.toLocaleLowerCase('es-CO').includes(normalizedSearch),
          )
        return (
          matchesSearch &&
          (!status || item.estado === status) &&
          (!priority || item.prioridad === priority)
        )
      })
      .sort((first, second) => {
        const difference = first.fechaRadicado.toMillis() - second.fechaRadicado.toMillis()
        return sortDescending ? -difference : difference
      })
  }, [expedients, priority, search, sortDescending, status])

  const totalPages = Math.max(1, Math.ceil(filteredExpedients.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedExpedients = filteredExpedients.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setPage(1)
  }

  const openNew = () => {
    setSelectedExpedient(undefined)
    setFormOpen(true)
  }

  const openEdit = (expedient: Expedient) => {
    setSelectedExpedient(expedient)
    setFormOpen(true)
  }

  const archive = (expedient: Expedient) => {
    if (
      window.confirm(
        `¿Archivar el expediente ${expedient.numeroRadicado}? Podrás conservar su trazabilidad.`,
      )
    ) {
      archiveMutation.mutate(expedient.id)
    }
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Gestión documental</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Expedientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Consulta, registra y administra los expedientes documentales.
          </p>
        </div>
        {canManage && (
          <Button onClick={openNew}>
            <FilePlus2 size={17} /> Nuevo expediente
          </Button>
        )}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_10rem_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => updateFilter(setSearch, event.target.value)}
              className="pl-9"
              placeholder="Buscar por radicado, solicitante o trámite"
            />
          </div>
          <Select value={status} onChange={(event) => updateFilter(setStatus, event.target.value)}>
            <option value="">Todos los estados</option>
            {EXPEDIENT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select
            value={priority}
            onChange={(event) => updateFilter(setPriority, event.target.value)}
          >
            <option value="">Toda prioridad</option>
            {EXPEDIENT_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            type="button"
            onClick={() => setSortDescending((value) => !value)}
          >
            <ArrowDownUp size={16} /> Fecha
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Número radicado</th>
                <th className="px-5 py-3 font-medium">Primer solicitante</th>
                <th className="px-5 py-3 font-medium">Solicitantes</th>
                <th className="px-5 py-3 font-medium">Municipio</th>
                <th className="px-5 py-3 font-medium">Tipo de trámite</th>
                <th className="px-5 py-3 font-medium">Funcionario</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Prioridad</th>
                <th className="px-5 py-3 font-medium">Fecha límite</th>
                {canManage && (
                  <th className="px-5 py-3 font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td
                    colSpan={canManage ? 10 : 9}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    Cargando expedientes…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td
                    colSpan={canManage ? 10 : 9}
                    className="px-5 py-12 text-center text-destructive"
                  >
                    No fue posible cargar los expedientes.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && paginatedExpedients.length === 0 && (
                <tr>
                  <td
                    colSpan={canManage ? 10 : 9}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No hay expedientes que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {paginatedExpedients.map((item) => (
                <tr key={item.id} className="text-slate-700 hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-medium text-slate-900">{item.numeroRadicado}</td>
                  <td className="px-5 py-4">{item.solicitantes[0]?.nombre || 'Sin registrar'}</td>
                  <td className="px-5 py-4">{item.solicitantes.length}</td>
                  <td className="px-5 py-4">{item.predios[0]?.municipio || '—'}</td>
                  <td className="px-5 py-4">{item.tipoTramite || '—'}</td>
                  <td className="px-5 py-4">
                    {item.funcionarioAsignado?.nombreCompleto || 'Sin asignar'}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="info">{item.estado}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={priorityVariant(item.prioridad)}>
                      {item.prioridad || 'Sin prioridad'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <p>{formatDate(item.fechaLimite)}</p>
                    {item.fechaLimite && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {getRemainingBusinessDays(item.fechaLimite.toDate())} días hábiles
                      </p>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent" to={`/expedientes/${item.id}`} aria-label={`Abrir ${item.numeroRadicado}`}><ExternalLink size={16} /></Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-label={`Editar ${item.numeroRadicado}`}
                        >
                          <Edit3 size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => archive(item)}
                          aria-label={`Archivar ${item.numeroRadicado}`}
                          disabled={archiveMutation.isPending}
                        >
                          <Trash2 size={16} className="text-destructive" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {filteredExpedients.length} expediente{filteredExpedients.length === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>

      {formOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-slate-950/40 p-0 sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expedient-form-title"
        >
          <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-b-none p-5 shadow-2xl sm:rounded-xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="expedient-form-title" className="text-xl font-semibold text-slate-900">
                  {selectedExpedient ? 'Editar expediente' : 'Nuevo expediente'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Solo el número y fecha de radicado son obligatorios.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Cerrar formulario"
              >
                <X size={18} />
              </Button>
            </div>
            <ExpedientForm
              expedient={selectedExpedient}
              isSaving={saveMutation.isPending}
              onCancel={() => setFormOpen(false)}
              onSubmit={async (values) => saveMutation.mutateAsync(values)}
            />
            {saveMutation.isError && (
              <p className="mt-4 text-sm text-destructive">
                No fue posible guardar el expediente. Intenta nuevamente.
              </p>
            )}
          </Card>
        </div>
      )}
    </section>
  )
}
