import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Alert, ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { ExpedientForm } from '@/features/expedients/components/expedient-form'
import { EXPEDIENT_QUERIES } from '@/features/expedients/expedient-queries'
import { useAuth } from '@/hooks/use-auth'
import { toDateKey } from '@/lib/expedient-deadline'
import {
  correctFiling,
  correctWorkflowDocument,
  updateExpedient,
} from '@/services/expedient.service'
import type { FilingRecord } from '@/services/filing.service'
import type { Expedient, WorkflowDocument } from '@/types/expedient'

function useRefreshExpedients() {
  const client = useQueryClient()
  return () =>
    Promise.all(EXPEDIENT_QUERIES.map((key) => client.invalidateQueries({ queryKey: [key] })))
}

/** Corrige número y fecha de un radicado de salida, traslado o ampliación. */
export function EditFilingDialog({
  filing,
  onClose,
}: {
  filing: FilingRecord
  onClose: () => void
}) {
  const { user } = useAuth()
  const toast = useToast()
  const refresh = useRefreshExpedients()
  const [number, setNumber] = useState(filing.numero)
  const [date, setDate] = useState(filing.fecha)
  const save = useMutation({
    mutationFn: () => correctFiling(filing, { number, date }, user!.uid),
    onSuccess: async () => {
      await refresh()
      onClose()
      toast({ title: 'Radicado corregido', description: `${filing.tipo} ${number.trim()}.` })
    },
  })
  const unchanged = number.trim() === filing.numero && date === filing.fecha

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      busy={save.isPending}
      kicker={`Radicado de ${filing.tipo.toLocaleLowerCase('es-CO')}`}
      title="Corregir radicado"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || unchanged || !number.trim() || !date}
          >
            {save.isPending ? 'Guardando…' : 'Guardar corrección'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorAlert error={save.error} fallback="No fue posible corregir el radicado." />
        <Field label="Número de radicado" required>
          <Input value={number} onChange={(event) => setNumber(event.target.value)} />
        </Field>
        <Field label="Fecha de radicado" required>
          <Input
            type="date"
            max={toDateKey(new Date())}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Se actualiza también en el expediente y en sus documentos. El cambio queda en el
          historial.
        </p>
      </div>
    </Dialog>
  )
}

/** Corrige nombre, enlace o folios de un documento asociado. */
export function EditDocumentDialog({
  expedientId,
  document,
  onClose,
}: {
  expedientId: string
  document: WorkflowDocument
  onClose: () => void
}) {
  const { user } = useAuth()
  const toast = useToast()
  const refresh = useRefreshExpedients()
  const [name, setName] = useState(document.nombre)
  const [url, setUrl] = useState(document.url)
  const [folios, setFolios] = useState(document.folios ? String(document.folios) : '')
  const save = useMutation({
    mutationFn: () =>
      correctWorkflowDocument(expedientId, document.id, { name, url, folios }, user!.uid),
    onSuccess: async () => {
      await refresh()
      onClose()
      toast({ title: 'Documento corregido' })
    },
  })

  return (
    <Dialog
      open
      onClose={onClose}
      busy={save.isPending}
      title="Corregir documento"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar corrección'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <div className="sm:col-span-2">
          <ErrorAlert error={save.error} fallback="No fue posible corregir el documento." />
        </div>
        <Field label="Nombre del documento" required>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Folios">
          <Input
            type="number"
            min={1}
            value={folios}
            onChange={(event) => setFolios(event.target.value)}
          />
        </Field>
        <Field label="Enlace de OneDrive o SharePoint" required className="sm:col-span-2">
          <Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

/** Edita los datos del expediente desde su detalle, también si ya está cerrado. */
export function EditExpedientDialog({
  expedient,
  onClose,
}: {
  expedient: Expedient
  onClose: () => void
}) {
  const { user } = useAuth()
  const toast = useToast()
  const refresh = useRefreshExpedients()
  const save = useMutation({
    mutationFn: (values: Parameters<typeof updateExpedient>[1]) =>
      updateExpedient(expedient.id, values, user!.uid, expedient.funcionarioAsignado),
    onSuccess: async () => {
      await refresh()
      onClose()
      toast({ title: 'Cambios guardados', description: `Radicado ${expedient.numeroRadicado}.` })
    },
  })

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      busy={save.isPending}
      kicker={`Radicado ${expedient.numeroRadicado}`}
      title="Editar datos del expediente"
      description="Los cambios quedan en el historial. El estado del flujo no cambia."
    >
      <div className="space-y-4">
        {!expedient.activo && (
          <Alert tone="warning">
            Este expediente está cerrado. Corrige solo información que haya quedado mal registrada.
          </Alert>
        )}
        <ErrorAlert error={save.error} fallback="No fue posible guardar el expediente." />
        <ExpedientForm
          expedient={expedient}
          isSaving={save.isPending}
          onCancel={onClose}
          onSubmit={async (values) => {
            await save.mutateAsync(values).catch(() => undefined)
          }}
        />
      </div>
    </Dialog>
  )
}
