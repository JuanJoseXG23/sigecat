import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, FolderOpen, Scale } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_ONEDRIVE_FOLDER } from '@/components/one-drive-document-selector'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Alert, ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EXPEDIENT_QUERIES } from '@/features/expedients/expedient-queries'
import { useAuth } from '@/hooks/use-auth'
import { useBusinessConfiguration } from '@/hooks/use-business-configuration'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import {
  EMPTY_EXTENSION_INPUT,
  getAvailableExtensionDays,
  getExtensionError,
  MAX_EXTENSION_FACTOR,
  previewExtendedDeadline,
  type ExtensionInput,
} from '@/lib/deadline-extension'
import { toDateKey } from '@/lib/expedient-deadline'
import { formatDate, formatLongDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { extendExpedientDeadline } from '@/services/expedient.service'
import type { Expedient } from '@/types/expedient'

interface ExtensionDialogProps {
  expedient: Expedient
  onClose: () => void
  onCompleted: (newDeadline: Date) => void
}

export function ExtensionDialog({ expedient, onClose, onCompleted }: ExtensionDialogProps) {
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const { data: configuration } = useBusinessConfiguration()
  const { data: procedureTypes = [] } = useProcedureTypes()
  const [values, setValues] = useState<ExtensionInput>({
    ...EMPTY_EXTENSION_INPUT,
    filingDate: toDateKey(new Date()),
  })
  const [days, setDays] = useState('')
  const update = (changes: Partial<ExtensionInput>) => setValues({ ...values, ...changes })

  const responseDays =
    expedient.diasTermino ??
    procedureTypes.find((type) => type.id === expedient.tipoTramiteId)?.diasRespuesta ??
    0
  const previousExtensionDays = expedient.diasAmpliacion ?? 0
  const available = getAvailableExtensionDays({ responseDays, previousExtensionDays })
  const currentDeadline = expedient.fechaLimite!.toDate()
  const input: ExtensionInput = { ...values, requestedDays: days ? Number(days) : 0 }
  const missing = responseDays
    ? getExtensionError(input, {
        entryDate: toDateKey(expedient.fechaRadicado.toDate()),
        currentDeadline,
        responseDays,
        previousExtensionDays,
        holidays: configuration?.diasFestivos,
      })
    : 'No se conoce el término inicial del tipo de trámite.'
  const preview = previewExtendedDeadline(
    currentDeadline,
    input.requestedDays,
    configuration?.diasFestivos,
  )
  const quickOptions = [...new Set([5, 10, 15, available])].filter(
    (option) => option > 0 && option <= available,
  )

  const save = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.')
      return extendExpedientDeadline(
        expedient.id,
        input,
        user.uid,
        profile?.nombreCompleto ?? user.email ?? 'Usuario',
      )
    },
    onSuccess: async (newDeadline) => {
      await Promise.all(
        EXPEDIENT_QUERIES.map((key) => client.invalidateQueries({ queryKey: [key] })),
      )
      onCompleted(newDeadline)
    },
  })

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      busy={save.isPending}
      kicker={`Radicado ${expedient.numeroRadicado}`}
      title="Ampliar plazo de respuesta"
      description={`Fecha límite actual: ${formatLongDate(currentDeadline)}.`}
      footer={
        <>
          {missing && (
            <p className="text-sm text-muted-foreground sm:mr-auto">
              <span className="font-medium text-amber-700">Falta:</span> {missing}
            </p>
          )}
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button disabled={save.isPending || Boolean(missing)} onClick={() => save.mutate()}>
            <CalendarPlus size={17} />
            {save.isPending ? 'Guardando…' : 'Registrar ampliación'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorAlert error={save.error} fallback="No fue posible ampliar el plazo." />
        <Alert tone="info" title="Ley 1755 de 2015, art. 14, parágrafo">
          Antes de que venza el término se informa al peticionario el motivo de la demora y el plazo
          en que se responderá, que no puede exceder el doble del inicialmente previsto.
        </Alert>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              1. Radicado de la solicitud de ampliación
            </h3>
            <a
              href={expedient.carpetaOneDrive?.trim() || DEFAULT_ONEDRIVE_FOLDER}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-info hover:underline"
            >
              <FolderOpen size={16} /> Abrir OneDrive
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número de radicado" required>
              <Input
                value={values.filingNumber}
                onChange={(event) => update({ filingNumber: event.target.value })}
                placeholder="Ej. S-2026-00410"
              />
            </Field>
            <Field
              label="Fecha de radicado"
              required
              hint={`Debe ser a más tardar el ${formatDate(currentDeadline)}.`}
            >
              <Input
                type="date"
                max={toDateKey(new Date())}
                value={values.filingDate}
                onChange={(event) => update({ filingDate: event.target.value })}
              />
            </Field>
            <Field label="Nombre del documento" required>
              <Input
                value={values.documentName}
                onChange={(event) => update({ documentName: event.target.value })}
                placeholder="Ej. Oficio de ampliación de plazo"
              />
            </Field>
            <Field label="Enlace del escaneo en OneDrive" required>
              <Input
                type="url"
                value={values.documentUrl}
                onChange={(event) => update({ documentUrl: event.target.value })}
                placeholder="https://girardotaa-my.sharepoint.com/…"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">2. Plazo solicitado</h3>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <Field label="Días hábiles" required>
              <Input
                type="number"
                min={1}
                max={available}
                inputMode="numeric"
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
            </Field>
            <div className="space-y-1.5">
              <span className="label">Atajos</span>
              <div className="flex flex-wrap gap-2">
                {quickOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDays(String(option))}
                    className={cn(
                      'h-10 rounded-lg border px-3 text-sm font-medium transition',
                      days === String(option)
                        ? 'border-primary bg-primary text-white'
                        : 'border-input bg-white hover:border-primary/50',
                    )}
                  >
                    {option === available ? `${option} (máximo)` : option}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <Scale size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                Término inicial: <b className="text-slate-800">{responseDays} días hábiles</b>.
                {previousExtensionDays > 0 && ` Ya ampliado: ${previousExtensionDays}.`} Disponible:{' '}
                <b className="text-slate-800">{available}</b> (máximo {MAX_EXTENSION_FACTOR}×).
              </p>
            </div>
            <div
              className={cn(
                'flex gap-3 rounded-xl border p-3 text-sm',
                preview ? 'border-primary/30 bg-primary/5' : 'border-dashed border-border',
              )}
            >
              <CalendarPlus size={18} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-muted-foreground">
                Nueva fecha límite:{' '}
                <b className="text-slate-900">
                  {preview ? formatLongDate(preview) : 'indica los días'}
                </b>
              </p>
            </div>
          </div>
        </section>

        <Field
          label="3. Motivo de la ampliación"
          required
          hint="Se comunica al peticionario y queda en el historial."
        >
          <Textarea
            value={values.reason}
            onChange={(event) => update({ reason: event.target.value })}
            placeholder="Ej. Se requiere visita técnica al predio para verificar linderos."
            className="min-h-24"
          />
        </Field>
      </div>
    </Dialog>
  )
}
