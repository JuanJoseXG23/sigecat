import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ArrowRightLeft, MessageSquareReply, UserCog } from 'lucide-react'
import { useState } from 'react'
import { OneDriveDocumentSelector } from '@/components/one-drive-document-selector'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useAuth } from '@/hooks/use-auth'
import { EXPEDIENT_QUERIES } from '@/features/expedients/expedient-queries'
import { useAddExpedientWorkflowDocument } from '@/hooks/use-expedient-workflow-documents'
import { toDateKey } from '@/lib/expedient-deadline'
import {
  EMPTY_ACTUATION_INPUT,
  getMissingRequirement,
  getStepDefinition,
  planActuation,
  type Actuation,
  type ActuationInput,
  type ResponseChoice,
} from '@/lib/expedient-workflow'
import { cn } from '@/lib/utils'
import { applyActuation } from '@/services/expedient.service'
import type { Expedient } from '@/types/expedient'

const choices: { value: ResponseChoice; label: string; hint: string; icon: typeof ArrowRight }[] = [
  {
    value: 'response',
    label: 'Responder al ciudadano',
    hint: 'Proyectar y radicar la respuesta.',
    icon: MessageSquareReply,
  },
  {
    value: 'transfer',
    label: 'Trasladar por competencia',
    hint: 'Remitir a otra entidad o dependencia (art. 21, Ley 1755).',
    icon: ArrowRightLeft,
  },
  {
    value: 'change',
    label: 'Cambiar responsable',
    hint: 'Reasignar sin avanzar el flujo.',
    icon: UserCog,
  },
]

interface ActuationDialogProps {
  expedient: Expedient
  onClose: () => void
  onCompleted: (actuation: Actuation) => void
}

export function ActuationDialog({ expedient, onClose, onCompleted }: ActuationDialogProps) {
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const { data: officials = [] } = useAssignableOfficials()
  const addDocument = useAddExpedientWorkflowDocument()
  const [values, setValues] = useState(EMPTY_ACTUATION_INPUT)
  const [responsibleUid, setResponsibleUid] = useState('')
  const status = expedient.estado
  const step = getStepDefinition(status)
  const documents = expedient.documentosWorkflow ?? []
  const responsible = officials.find((entry) => entry.uid === responsibleUid)
  const input: ActuationInput = {
    ...values,
    assignee: responsible && { uid: responsible.uid, nombreCompleto: responsible.nombreCompleto },
  }
  const missing = getMissingRequirement(status, input, documents)
  const update = (changes: Partial<ActuationInput>) => setValues({ ...values, ...changes })

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.')
      const actuation = planActuation(expedient, input)
      await applyActuation(expedient.id, actuation, user.uid)
      return actuation
    },
    onSuccess: async (actuation) => {
      await Promise.all(
        EXPEDIENT_QUERIES.map((key) => client.invalidateQueries({ queryKey: [key] })),
      )
      onCompleted(actuation)
    },
  })

  const officialSelect = (label: string) => (
    <Field label={label} required>
      <Select value={responsibleUid} onChange={(event) => setResponsibleUid(event.target.value)}>
        <option value="">Selecciona un funcionario de Catastro</option>
        {officials
          .filter((entry) => entry.uid !== expedient.funcionarioAsignado?.uid)
          .map((entry) => (
            <option key={entry.uid} value={entry.uid}>
              {entry.nombreCompleto} · {entry.rol}
            </option>
          ))}
      </Select>
    </Field>
  )

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      busy={save.isPending}
      kicker={`Radicado ${expedient.numeroRadicado} · ${status}`}
      title={step.title === 'Completar actuación' ? status : step.title}
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
            {save.isPending ? 'Guardando…' : 'Guardar y continuar'}
            <ArrowRight size={18} />
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorAlert
          error={save.error ?? addDocument.error}
          fallback="No fue posible guardar la actuación."
        />

        {step.document && (
          <OneDriveDocumentSelector
            folderUrl={expedient.carpetaOneDrive}
            documents={documents}
            description={step.document.description}
            requiredDocumentType={step.document.type}
            onAddDocument={(document) => {
              if (!user || !step.document) return
              const userName = profile?.nombreCompleto ?? user.email ?? 'Usuario'
              addDocument.mutate({
                expedientId: expedient.id,
                documentData: { ...document, tipo: step.document.type, usuario: userName },
                userId: user.uid,
                userName,
              })
            }}
            isLoading={addDocument.isPending}
          />
        )}

        {step.requiresSignature && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm transition hover:border-primary/40">
            <input
              type="checkbox"
              checked={values.signed}
              onChange={(event) => update({ signed: event.target.checked })}
              className="mt-0.5 size-5 shrink-0 rounded"
            />
            <span>
              <span className="font-semibold text-slate-900">
                El formato físico de recepción está firmado
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Confirma que el peticionario firmó el formato y que se escaneó completo.
              </span>
            </span>
          </label>
        )}

        {step.requiresAssignee && officialSelect('Responsable del trámite')}

        {step.offersChoice && (
          <fieldset className="space-y-3">
            <legend className="label mb-2">¿Qué actuación sigue?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {choices.map(({ value, label, hint, icon: Icon }) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition',
                    values.choice === value
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name="choice"
                    value={value}
                    checked={values.choice === value}
                    onChange={() => update({ choice: value })}
                    className="sr-only"
                  />
                  <Icon size={18} className="text-primary" />
                  <span className="font-semibold text-slate-900">{label}</span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </label>
              ))}
            </div>
            {values.choice === 'transfer' && (
              <div className="grid gap-3">
                <Field label="Entidad o dependencia destino" required>
                  <Input
                    value={values.destination}
                    onChange={(event) => update({ destination: event.target.value })}
                    placeholder="Ej. Secretaría de Planeación"
                  />
                </Field>
                <Field
                  label="Motivo del traslado"
                  required
                  hint="El traslado debe hacerse dentro de los 5 días hábiles siguientes a la recepción."
                >
                  <Textarea
                    value={values.reason}
                    onChange={(event) => update({ reason: event.target.value })}
                    className="min-h-20"
                  />
                </Field>
              </div>
            )}
            {values.choice === 'change' && officialSelect('Nuevo responsable')}
          </fieldset>
        )}

        {step.requiresFiling && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número de radicado de salida" required>
              <Input
                value={values.filingNumber}
                onChange={(event) => update({ filingNumber: event.target.value })}
                placeholder="Ej. S-2026-00321"
              />
            </Field>
            <Field label="Fecha de radicado" required>
              <Input
                type="date"
                max={toDateKey(new Date())}
                value={values.filingDate}
                onChange={(event) => update({ filingDate: event.target.value })}
              />
            </Field>
          </div>
        )}

        <Field label="Observaciones" hint="Opcional. Quedan en el historial del expediente.">
          <Textarea
            value={values.notes}
            onChange={(event) => update({ notes: event.target.value })}
            className="min-h-20 resize-y"
          />
        </Field>
      </div>
    </Dialog>
  )
}
