import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileCog, Pencil, Plus, PowerOff, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { Alert, EmptyState, ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { useToast } from '@/components/ui/toast-context'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import { normalizeSearch } from '@/lib/format'
import { deactivateProcedureType, saveProcedureType } from '@/services/procedure-type.service'
import type { ProcedureType, ProcedureTypeInput } from '@/types/procedure-type'

const schema = z.object({
  nombre: z.string().trim().min(1, 'Ingresa el nombre.'),
  descripcion: z.string().trim().optional(),
  diasRespuesta: z.coerce
    .number({ invalid_type_error: 'Indica los días hábiles.' })
    .int()
    .min(1, 'Indica los días hábiles.')
    .max(120),
  requiereVisita: z.boolean(),
  requiereRevisionJuridica: z.boolean(),
})
type FormInput = z.input<typeof schema>

const empty: FormInput = {
  nombre: '',
  descripcion: '',
  diasRespuesta: 15,
  requiereVisita: false,
  requiereRevisionJuridica: false,
}

const LEGAL_TERMS = [
  ['15', 'Petición general o particular'],
  ['10', 'Solicitud de documentos e información'],
  ['30', 'Consulta a la autoridad'],
] as const

export function ProcedureTypesPage() {
  const { data = [], isLoading } = useProcedureTypes()
  const client = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProcedureType>()
  const [deactivating, setDeactivating] = useState<ProcedureType>()
  const form = useForm<FormInput, unknown, ProcedureTypeInput>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  })
  const errors = form.formState.errors
  const refresh = () => client.invalidateQueries({ queryKey: ['procedure-types'] })
  const close = () => {
    setFormOpen(false)
    setEditing(undefined)
    form.reset(empty)
  }
  const save = useMutation({
    mutationFn: (values: ProcedureTypeInput) => saveProcedureType(values, editing?.id),
    onSuccess: async (_, values) => {
      await refresh()
      close()
      toast({ title: `Trámite “${values.nombre}” guardado` })
    },
  })
  const remove = useMutation({
    mutationFn: deactivateProcedureType,
    onSuccess: async () => {
      await refresh()
      setDeactivating(undefined)
      toast({ title: 'Trámite desactivado', description: 'Ya no se ofrece al radicar.' })
    },
  })
  const rows = useMemo(
    () => data.filter((item) => normalizeSearch(item.nombre).includes(normalizeSearch(search))),
    [data, search],
  )
  const openForm = (item?: ProcedureType) => {
    setEditing(item)
    form.reset(
      item
        ? {
            nombre: item.nombre,
            descripcion: item.descripcion ?? '',
            diasRespuesta: item.diasRespuesta,
            requiereVisita: item.requiereVisita,
            requiereRevisionJuridica: item.requiereRevisionJuridica,
          }
        : empty,
    )
    setFormOpen(true)
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="Administración"
        title="Tipos de trámite"
        description="Cada trámite define su término de respuesta en días hábiles."
        actions={
          <Button onClick={() => openForm()}>
            <Plus size={16} /> Nuevo trámite
          </Button>
        }
      />
      <ErrorAlert error={remove.error} fallback="No fue posible desactivar el trámite." />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar trámite"
          className="pl-9"
          aria-label="Buscar trámite"
        />
      </div>

      <div className="table-shell overflow-x-auto">
        <table className="data-table min-w-[640px]">
          <thead>
            <tr>
              <th>Trámite</th>
              <th>Término</th>
              <th>Requisitos</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td>
                  <p className="font-semibold text-slate-900">{item.nombre}</p>
                  {item.descripcion && (
                    <p className="max-w-64 truncate text-xs text-muted-foreground">
                      {item.descripcion}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap">{item.diasRespuesta} días hábiles</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {item.requiereVisita && <Badge variant="info">Visita</Badge>}
                    {item.requiereRevisionJuridica && <Badge variant="violet">Jurídica</Badge>}
                    {!item.requiereVisita && !item.requiereRevisionJuridica && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openForm(item)}
                      aria-label={`Editar ${item.nombre}`}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost-destructive"
                      size="icon"
                      onClick={() => setDeactivating(item)}
                      aria-label={`Desactivar ${item.nombre}`}
                    >
                      <PowerOff size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !rows.length && (
          <EmptyState
            icon={FileCog}
            title={search ? 'Sin resultados' : 'No hay tipos de trámite'}
            description="Crea el primero con sus días hábiles de respuesta."
          />
        )}
      </div>

      <Dialog
        open={formOpen}
        onClose={close}
        busy={save.isPending}
        title={editing ? 'Editar trámite' : 'Nuevo trámite'}
        description="El flujo institucional se aplica automáticamente a todos los trámites."
      >
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          noValidate
        >
          <ErrorAlert error={save.error} fallback="No fue posible guardar el trámite." />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <Field label="Nombre del trámite" required error={errors.nombre?.message}>
              <Input {...form.register('nombre')} placeholder="Ej. Rectificación de área" />
            </Field>
            <Field label="Días hábiles" required error={errors.diasRespuesta?.message}>
              <Input type="number" min={1} {...form.register('diasRespuesta')} />
            </Field>
            <Field label="Descripción" className="sm:col-span-2">
              <Input {...form.register('descripcion')} />
            </Field>
          </div>
          <Alert tone="info" title="Términos de la Ley 1755 de 2015">
            <ul className="mt-1 grid gap-x-4 sm:grid-cols-3">
              {LEGAL_TERMS.map(([days, label]) => (
                <li key={label}>
                  <b>{days} días</b> · {label}
                </li>
              ))}
            </ul>
          </Alert>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4" {...form.register('requiereVisita')} />
              Requiere visita técnica
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                {...form.register('requiereRevisionJuridica')}
              />
              Requiere revisión jurídica
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={close} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar trámite'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Desactivar trámite"
        confirmLabel="Desactivar"
        tone="destructive"
        pending={remove.isPending}
        onCancel={() => setDeactivating(undefined)}
        onConfirm={() => deactivating && remove.mutate(deactivating.id)}
      >
        “{deactivating?.nombre}” dejará de ofrecerse al radicar. Los expedientes existentes
        conservan su término.
      </ConfirmDialog>
    </section>
  )
}
