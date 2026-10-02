import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, FilePlus2, FolderOpen, Pencil, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState, ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast-context'
import { ExpedientForm } from '@/features/expedients/components/expedient-form'
import { ExpedientTable } from '@/features/expedients/components/expedient-table'
import { byUrgency, matchesExpedientSearch } from '@/features/expedients/expedient-filters'
import { useAuth } from '@/hooks/use-auth'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useExpedients } from '@/hooks/use-expedients'
import { canManageExpedient, isSupervisor } from '@/lib/permissions'
import { archiveExpedient, createExpedient, updateExpedient } from '@/services/expedient.service'
import type { Expedient, ExpedientFormData } from '@/types/expedient'
import { EXPEDIENT_PRIORITIES, EXPEDIENT_STATUSES } from '@/types/expedient'

const AFFECTED_QUERIES = ['expedients', 'work-tray', 'historical-expedients', 'expedient']

export function ExpedientsPage() {
  const { user, profile, hasRole } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { data: expedients = [], isLoading, isError } = useExpedients()
  const { data: officials = [] } = useAssignableOfficials()
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [editing, setEditing] = useState<Expedient | undefined>()
  const [archiving, setArchiving] = useState<Expedient | undefined>()
  const [archiveReason, setArchiveReason] = useState('')
  const canCreate = hasRole(['Administrador', 'Coordinador', 'Funcionario'])
  const canArchive = isSupervisor(profile)

  const search = params.get('q') ?? ''
  const creating = params.get('nuevo') === '1' && canCreate
  const formOpen = creating || Boolean(editing)

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  const refresh = () =>
    Promise.all(AFFECTED_QUERIES.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))

  const closeForm = () => {
    setEditing(undefined)
    if (creating) updateParams({ nuevo: null })
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ExpedientFormData) => {
      if (!user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.')
      const official = officials.find((item) => item.uid === values.funcionarioAsignadoUid)
      const assignedOfficial = official
        ? { uid: official.uid, nombreCompleto: official.nombreCompleto }
        : editing?.funcionarioAsignado
      if (editing) {
        await updateExpedient(editing.id, values, user.uid, assignedOfficial)
        return { id: undefined, assignedOfficialName: assignedOfficial?.nombreCompleto }
      }
      const id = await createExpedient(values, user.uid, assignedOfficial)
      return { id, assignedOfficialName: assignedOfficial?.nombreCompleto }
    },
    onSuccess: async (result, values) => {
      await refresh()
      closeForm()
      toast({
        title: result.id ? `Expediente ${values.numeroRadicado} radicado` : 'Cambios guardados',
        description: result.assignedOfficialName
          ? `Se notificará por correo a ${result.assignedOfficialName} en máximo cinco minutos.`
          : result.id
            ? 'Continúa con la confirmación de recepción.'
            : undefined,
      })
      if (result.id) navigate(`/expedientes/${result.id}`)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (item: Expedient) => archiveExpedient(item.id, user!.uid, archiveReason.trim()),
    onSuccess: async (_, item) => {
      await refresh()
      setArchiving(undefined)
      setArchiveReason('')
      toast({
        title: `Expediente ${item.numeroRadicado} archivado`,
        description: 'Lo encuentras en Histórico y retención.',
      })
    },
  })

  const rows = useMemo(
    () =>
      expedients
        .filter(
          (item) =>
            matchesExpedientSearch(item, search) &&
            (!status || item.estado === status) &&
            (!priority || item.prioridad === priority),
        )
        .sort(byUrgency),
    [expedients, priority, search, status],
  )
  const hasFilters = Boolean(search || status || priority)

  return (
    <section className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        kicker="Gestión documental"
        title="Expedientes"
        description="Expedientes activos, ordenados por urgencia del término de respuesta."
        actions={
          canCreate && (
            <Button onClick={() => updateParams({ nuevo: '1' })}>
              <FilePlus2 size={17} /> Radicar expediente
            </Button>
          )
        }
      />

      <ErrorAlert error={archiveMutation.error} fallback="No fue posible archivar el expediente." />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => updateParams({ q: event.target.value || null })}
            className="pl-9"
            placeholder="Radicado, solicitante, documento, número predial, matrícula o asunto"
            aria-label="Buscar expedientes"
          />
        </div>
        <Select
          className="md:w-56"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          {EXPEDIENT_STATUSES.slice(0, -2).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
        <Select
          className="md:w-44"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          aria-label="Prioridad"
        >
          <option value="">Toda prioridad</option>
          {EXPEDIENT_PRIORITIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              updateParams({ q: null })
              setStatus('')
              setPriority('')
            }}
          >
            <X size={16} /> Limpiar
          </Button>
        )}
      </div>

      <ExpedientTable
        key={`${search}|${status}|${priority}`}
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        empty={
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No hay expedientes activos que coincidan"
              description={
                <>
                  Si el expediente ya fue cerrado, búscalo en{' '}
                  <Link to="/historico" className="link">
                    Histórico y retención
                  </Link>
                  .
                </>
              }
            />
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="Aún no hay expedientes activos"
              description="Radica el primero para empezar a controlar sus términos."
              action={
                canCreate && (
                  <Button onClick={() => updateParams({ nuevo: '1' })}>
                    <FilePlus2 size={17} /> Radicar expediente
                  </Button>
                )
              }
            />
          )
        }
        actions={(item) => (
          <>
            {canManageExpedient(profile, item) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing(item)}
                aria-label={`Editar ${item.numeroRadicado}`}
                title="Editar datos"
              >
                <Pencil size={16} />
              </Button>
            )}
            {canArchive && (
              <Button
                variant="ghost-destructive"
                size="icon"
                onClick={() => setArchiving(item)}
                aria-label={`Archivar ${item.numeroRadicado}`}
                title="Archivar fuera del flujo"
              >
                <Archive size={16} />
              </Button>
            )}
          </>
        )}
      />

      <Dialog
        open={formOpen}
        onClose={closeForm}
        size="xl"
        busy={saveMutation.isPending}
        kicker={editing ? `Radicado ${editing.numeroRadicado}` : 'Ventanilla de radicación'}
        title={editing ? 'Editar expediente' : 'Radicar nuevo expediente'}
        description="Los campos marcados con * son obligatorios. El término se calcula en días hábiles."
      >
        <ErrorAlert error={saveMutation.error} fallback="No fue posible guardar el expediente." />
        <ExpedientForm
          expedient={editing}
          isSaving={saveMutation.isPending}
          onCancel={closeForm}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values).catch(() => undefined)
          }}
        />
      </Dialog>

      <ConfirmDialog
        open={Boolean(archiving)}
        title={`Archivar expediente ${archiving?.numeroRadicado ?? ''}`}
        confirmLabel="Archivar"
        tone="destructive"
        pending={archiveMutation.isPending}
        disabled={!archiveReason.trim()}
        onCancel={() => {
          setArchiving(undefined)
          setArchiveReason('')
        }}
        onConfirm={() => archiving && archiveMutation.mutate(archiving)}
      >
        <p>
          El expediente sale de la bandeja sin completar el flujo y pasa al Histórico. Su historial
          y documentos se conservan.
        </p>
        <Field label="Motivo del archivo" required className="mt-4" hint="Queda en el historial.">
          <Textarea
            value={archiveReason}
            onChange={(event) => setArchiveReason(event.target.value)}
            placeholder="Ej. Desistimiento expreso del peticionario"
            className="min-h-20"
          />
        </Field>
      </ConfirmDialog>
    </section>
  )
}
