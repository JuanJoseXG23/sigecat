import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Check,
  CircleDashed,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Hourglass,
  MessageSquareReply,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_ONEDRIVE_FOLDER } from '@/components/one-drive-document-selector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Alert, ErrorAlert } from '@/components/ui/feedback'
import { Field, Switch } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EXPEDIENT_QUERIES } from '@/features/expedients/expedient-queries'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useAuth } from '@/hooks/use-auth'
import { useBusinessConfiguration } from '@/hooks/use-business-configuration'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import { getAvailableExtensionDays, previewExtendedDeadline } from '@/lib/deadline-extension'
import { getCorrespondenceClass } from '@/lib/correspondence'
import { toDateKey } from '@/lib/expedient-deadline'
import { describeRemainingDays, formatDate, formatLongDate } from '@/lib/format'
import {
  buildLateTimeline,
  EMPTY_LATE_REGISTRATION,
  getLateRegistrationIssue,
  getLateRegistrationScope,
  TRANSFER_TERM_DAYS,
  type ExistingDocument,
  type LateFilingInput,
  type LateOutcome,
  type LateRegistrationContext,
  type LateRegistrationInput,
  type LateRegistrationPlan,
  type LateSection,
  type TimelineTone,
} from '@/lib/late-registration'
import { cn } from '@/lib/utils'
import { getLatestDocuments, registerLateActuations } from '@/services/expedient.service'
import type { AssignedOfficial, Expedient } from '@/types/expedient'

const REASON_SUGGESTIONS = [
  'Alto flujo de trabajo en la oficina; se respondió a tiempo pero no se subió a la aplicación.',
  'Se tramitó por fuera de la aplicación y se registra para dejar el expediente al día.',
]

const sectionTitles: Record<LateSection, string> = {
  situation: 'Situación',
  start: 'Recepción',
  extension: 'Ampliación',
  outcome: 'Radicados',
  review: 'Revisión',
}

const toneStyles: Record<TimelineTone, string> = {
  neutral: 'bg-slate-300',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
}

function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  )
}

function ChoiceCard({
  selected,
  onSelect,
  icon: Icon,
  label,
  hint,
}: {
  selected: boolean
  onSelect: () => void
  icon: LucideIcon
  label: string
  hint: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-primary/40',
      )}
    >
      <input type="radio" checked={selected} onChange={onSelect} className="sr-only" />
      <Icon size={18} className="text-primary" />
      <span className="font-semibold text-slate-900">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  )
}

/** Número, fechas reales y escaneo de un radicado ya enviado. */
function FilingFields({
  title,
  value,
  onChange,
  minDate,
  existingDocument,
  placeholder,
}: {
  title: string
  value: LateFilingInput
  onChange: (value: LateFilingInput) => void
  minDate: string
  existingDocument?: ExistingDocument
  placeholder: string
}) {
  const today = toDateKey(new Date())
  const update = (changes: Partial<LateFilingInput>) => onChange({ ...value, ...changes })
  return (
    <fieldset className="space-y-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Número de radicado" required>
          <Input
            value={value.number}
            onChange={(event) => update({ number: event.target.value })}
            placeholder={placeholder}
          />
        </Field>
        <Field label="Fecha de radicado" required hint="La que aparece en el sello.">
          <Input
            type="date"
            min={minDate}
            max={today}
            value={value.date}
            onChange={(event) =>
              update({
                date: event.target.value,
                // Lo más común es enviarlo el mismo día: se propone y se puede cambiar.
                sentDate:
                  !value.sentDate || value.sentDate < event.target.value
                    ? event.target.value
                    : value.sentDate,
              })
            }
          />
        </Field>
        <Field label="Fecha de envío" required hint="Correo o entrega al destinatario.">
          <Input
            type="date"
            min={value.date || minDate}
            max={today}
            value={value.sentDate}
            onChange={(event) => update({ sentDate: event.target.value })}
          />
        </Field>
      </div>
      {existingDocument && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <FileText size={16} className="shrink-0" />
          <span>
            Ya está asociado <b>{existingDocument.nombre}</b>. Deja el escaneo vacío para usarlo
            como soporte.
          </span>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_6rem]">
        <Field label="Nombre del escaneo" required={!existingDocument}>
          <Input
            value={value.documentName}
            onChange={(event) => update({ documentName: event.target.value })}
            placeholder="Ej. Respuesta radicada"
          />
        </Field>
        <Field label="Enlace de OneDrive" required={!existingDocument}>
          <Input
            type="url"
            value={value.documentUrl}
            onChange={(event) => update({ documentUrl: event.target.value })}
            placeholder="https://girardotaa-my.sharepoint.com/…"
          />
        </Field>
        <Field label="Folios">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={value.folios}
            onChange={(event) => update({ folios: event.target.value })}
          />
        </Field>
      </div>
    </fieldset>
  )
}

interface LateRegistrationDialogProps {
  expedient: Expedient
  onClose: () => void
  onCompleted: (plan: LateRegistrationPlan) => void
}

/**
 * Asistente para subir actuaciones que se hicieron a tiempo en la oficina pero no se
 * registraron: pide las fechas reales, muestra cómo quedan frente al término y guarda todo
 * de una vez en el orden del flujo.
 */
export function LateRegistrationDialog({
  expedient,
  onClose,
  onCompleted,
}: LateRegistrationDialogProps) {
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const { data: configuration } = useBusinessConfiguration()
  const { data: procedureTypes = [] } = useProcedureTypes()
  const { data: officials = [] } = useAssignableOfficials()
  const scope = getLateRegistrationScope(expedient.estado)!
  const [values, setValues] = useState<LateRegistrationInput>({
    ...EMPTY_LATE_REGISTRATION,
    outcome: scope.outcomes[0],
  })
  const [days, setDays] = useState('')
  const [assigneeUid, setAssigneeUid] = useState('')
  const [respondedByUid, setRespondedByUid] = useState('')
  const [current, setCurrent] = useState<LateSection>('situation')
  const update = (changes: Partial<LateRegistrationInput>) =>
    setValues((previous) => ({ ...previous, ...changes }))

  const toOfficial = (uid: string): AssignedOfficial | undefined => {
    const entry = officials.find((official) => official.uid === uid)
    return entry && { uid: entry.uid, nombreCompleto: entry.nombreCompleto }
  }
  const input: LateRegistrationInput = {
    ...values,
    extension: { ...values.extension, requestedDays: days ? Number(days) : 0 },
    assignee: toOfficial(assigneeUid),
    respondedBy: toOfficial(respondedByUid),
  }

  const responseDays =
    expedient.diasTermino ??
    procedureTypes.find((type) => type.id === expedient.tipoTramiteId)?.diasRespuesta ??
    0
  const existingDocuments = useMemo(() => getLatestDocuments(expedient), [expedient])
  const context: LateRegistrationContext = {
    status: expedient.estado,
    entryNumber: expedient.numeroRadicado,
    entryDate: toDateKey(expedient.fechaRadicado.toDate()),
    currentDeadline: expedient.fechaLimite!.toDate(),
    responseDays,
    previousExtensionDays: expedient.diasAmpliacion ?? 0,
    currentAssignee: expedient.funcionarioAsignado,
    existingDocuments,
    holidays: configuration?.diasFestivos,
    correspondenceClass: getCorrespondenceClass(expedient),
  }
  const issue = responseDays
    ? getLateRegistrationIssue(input, context)
    : { section: 'situation' as const, message: 'No se conoce el término inicial del trámite.' }
  const timeline = buildLateTimeline(input, context)
  const deadlineKey = toDateKey(context.currentDeadline)
  const today = toDateKey(new Date())
  const available = getAvailableExtensionDays({
    responseDays,
    previousExtensionDays: context.previousExtensionDays,
  })
  const preview = previewExtendedDeadline(
    context.currentDeadline,
    input.extension.requestedDays,
    configuration?.diasFestivos,
  )
  const citizen = values.outcome === 'transfer' || scope.citizenResponseOnly
  const handler = input.assignee ?? expedient.funcionarioAsignado

  const sections: LateSection[] = [
    'situation',
    ...(scope.receipt || scope.assignee ? (['start'] as const) : []),
    ...(values.extensionEnabled ? (['extension'] as const) : []),
    ...(values.outcome !== 'pending' ? (['outcome'] as const) : []),
    'review',
  ]
  const position = Math.max(0, sections.indexOf(current))
  const blockedAt = issue ? sections.indexOf(issue.section) : sections.length
  const canAdvance = blockedAt > position
  const go = (section: LateSection) => setCurrent(section)

  const save = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.')
      return registerLateActuations(
        expedient.id,
        input,
        user.uid,
        profile?.nombreCompleto ?? user.email ?? 'Usuario',
      )
    },
    onSuccess: async (plan) => {
      await Promise.all(
        EXPEDIENT_QUERIES.map((key) => client.invalidateQueries({ queryKey: [key] })),
      )
      onCompleted(plan)
    },
  })

  const outcomeChoices: Record<LateOutcome, { icon: LucideIcon; label: string; hint: string }> = {
    response: {
      icon: MessageSquareReply,
      label: scope.citizenResponseOnly ? 'Se respondió al ciudadano' : 'Se respondió',
      hint: 'Ya se radicó y envió la respuesta. El expediente se finaliza.',
    },
    transfer: {
      icon: ArrowRightLeft,
      label: 'Se trasladó por competencia',
      hint: 'Ya se radicó el oficio de traslado a otra entidad o dependencia.',
    },
    pending: {
      icon: CircleDashed,
      label: 'Sigue en trámite',
      hint: 'Solo poner al día lo ya hecho, como la ampliación de plazo.',
    },
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      busy={save.isPending}
      kicker={`Radicado ${expedient.numeroRadicado} · ${expedient.estado}`}
      title="Registrar actuaciones atrasadas"
      description="Para lo que se hizo a tiempo en la oficina y no se subió. El término se mide con las fechas reales de los radicados, no con la de hoy."
      footer={
        <>
          {issue && blockedAt <= position && (
            <p className="text-sm text-muted-foreground sm:mr-auto">
              <span className="font-medium text-amber-700">Falta:</span> {issue.message}
            </p>
          )}
          {position > 0 ? (
            <Button
              variant="outline"
              onClick={() => go(sections[position - 1])}
              disabled={save.isPending}
            >
              <ArrowLeft size={17} /> Atrás
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
          )}
          {current === 'review' ? (
            <Button disabled={save.isPending || Boolean(issue)} onClick={() => save.mutate()}>
              <ClipboardCheck size={17} />
              {save.isPending ? 'Guardando…' : 'Guardar registro'}
            </Button>
          ) : (
            <Button disabled={!canAdvance} onClick={() => go(sections[position + 1])}>
              Siguiente <ArrowRight size={17} />
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <ol className="flex flex-wrap gap-2" aria-label="Pasos del registro">
          {sections.map((section, index) => {
            const reachable = index <= position || index <= blockedAt
            return (
              <li key={section}>
                <button
                  type="button"
                  disabled={!reachable || save.isPending}
                  onClick={() => go(section)}
                  aria-current={section === current ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                    section === current
                      ? 'border-primary bg-primary text-white'
                      : index < position
                        ? 'border-primary/30 bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {index < position ? <Check size={12} strokeWidth={3} /> : index + 1}
                  {sectionTitles[section]}
                </button>
              </li>
            )
          })}
        </ol>

        <ErrorAlert error={save.error} fallback="No fue posible guardar el registro." />

        {current === 'situation' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted/50 px-4 py-3 text-sm">
              <span>
                En la aplicación quedó en <b className="text-slate-900">{expedient.estado}</b>
              </span>
              <span className="text-muted-foreground">
                Vence {formatDate(context.currentDeadline)} ·{' '}
                {describeRemainingDays(expedient.diasRestantes)}
              </span>
            </div>

            <fieldset className="space-y-2">
              <legend className="label mb-2">¿Qué pasó en realidad con este trámite?</legend>
              <div
                className={cn(
                  'grid gap-2',
                  scope.outcomes.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
                )}
              >
                {scope.outcomes.map((outcome) => (
                  <ChoiceCard
                    key={outcome}
                    selected={values.outcome === outcome}
                    onSelect={() => update({ outcome })}
                    {...outcomeChoices[outcome]}
                  />
                ))}
              </div>
            </fieldset>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
              <div className="flex gap-3">
                <Hourglass size={18} className="mt-0.5 shrink-0 text-primary" />
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">
                    Se solicitó ampliación de plazo antes del vencimiento
                  </p>
                  <p className="text-muted-foreground">
                    Necesitarás el oficio radicado y los días hábiles solicitados (normalmente entre
                    10 y 15).
                  </p>
                </div>
              </div>
              <Switch
                label="Se solicitó ampliación de plazo"
                checked={values.extensionEnabled}
                onChange={(extensionEnabled) => update({ extensionEnabled })}
              />
            </div>

            <Field
              label="¿Por qué no se registró a tiempo?"
              required
              hint="Queda en el historial del expediente y en el libro de radicación."
            >
              <Textarea
                value={values.reason}
                onChange={(event) => update({ reason: event.target.value })}
                className="min-h-20"
              />
            </Field>
            <div className="-mt-2 flex flex-wrap gap-2">
              {REASON_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => update({ reason: suggestion })}
                  className="rounded-full border border-border px-3 py-1 text-left text-xs text-slate-700 transition hover:border-primary/50 hover:text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {current === 'start' && (
          <div className="space-y-5">
            <SectionHeading title="Recepción y responsable">
              Los pasos que quedaron pendientes al recibir la petición.
            </SectionHeading>
            {scope.receipt && !existingDocuments.RECIBIDO && (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_6rem]">
                <Field label="Documento recibido" required>
                  <Input
                    value={values.receipt.documentName}
                    onChange={(event) =>
                      update({ receipt: { ...values.receipt, documentName: event.target.value } })
                    }
                    placeholder="Ej. Petición escaneada"
                  />
                </Field>
                <Field label="Enlace de OneDrive" required>
                  <Input
                    type="url"
                    value={values.receipt.documentUrl}
                    onChange={(event) =>
                      update({ receipt: { ...values.receipt, documentUrl: event.target.value } })
                    }
                    placeholder="https://girardotaa-my.sharepoint.com/…"
                  />
                </Field>
                <Field label="Folios">
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={values.receipt.folios}
                    onChange={(event) =>
                      update({ receipt: { ...values.receipt, folios: event.target.value } })
                    }
                  />
                </Field>
              </div>
            )}
            {scope.receipt && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm transition hover:border-primary/40">
                <input
                  type="checkbox"
                  checked={values.receipt.signed}
                  onChange={(event) =>
                    update({ receipt: { ...values.receipt, signed: event.target.checked } })
                  }
                  className="mt-0.5 size-5 shrink-0 rounded"
                />
                <span>
                  <span className="font-semibold text-slate-900">
                    El formato físico de recepción está firmado
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Confirma que el peticionario lo firmó y que se escaneó completo.
                  </span>
                </span>
              </label>
            )}
            {scope.assignee && (
              <Field label="Responsable del trámite" required>
                <Select
                  value={assigneeUid}
                  onChange={(event) => setAssigneeUid(event.target.value)}
                >
                  <option value="">Selecciona un funcionario de Catastro</option>
                  {officials.map((entry) => (
                    <option key={entry.uid} value={entry.uid}>
                      {entry.nombreCompleto} · {entry.rol}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        {current === 'extension' && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <SectionHeading title="Ampliación de plazo">
                Debió radicarse a más tardar el{' '}
                <b className="text-slate-800">{formatLongDate(context.currentDeadline)}</b>. Si se
                radicó después, la ampliación no procede.
              </SectionHeading>
              <a
                href={expedient.carpetaOneDrive?.trim() || DEFAULT_ONEDRIVE_FOLDER}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-info hover:underline"
              >
                <FolderOpen size={16} /> OneDrive
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Número de radicado" required>
                <Input
                  value={values.extension.filingNumber}
                  onChange={(event) =>
                    update({ extension: { ...values.extension, filingNumber: event.target.value } })
                  }
                  placeholder="Ej. 20262000410"
                />
              </Field>
              <Field label="Fecha de radicado" required>
                <Input
                  type="date"
                  min={context.entryDate}
                  max={deadlineKey < today ? deadlineKey : today}
                  value={values.extension.filingDate}
                  onChange={(event) =>
                    update({ extension: { ...values.extension, filingDate: event.target.value } })
                  }
                />
              </Field>
              <Field label="Nombre del oficio escaneado" required>
                <Input
                  value={values.extension.documentName}
                  onChange={(event) =>
                    update({ extension: { ...values.extension, documentName: event.target.value } })
                  }
                  placeholder="Ej. Oficio de ampliación de plazo"
                />
              </Field>
              <Field label="Enlace de OneDrive" required>
                <Input
                  type="url"
                  value={values.extension.documentUrl}
                  onChange={(event) =>
                    update({ extension: { ...values.extension, documentUrl: event.target.value } })
                  }
                  placeholder="https://girardotaa-my.sharepoint.com/…"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <Field label="Días hábiles solicitados" required>
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
                  {[...new Set([10, 15, available])]
                    .filter((option) => option > 0 && option <= available)
                    .map((option) => (
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
            <p
              className={cn(
                'rounded-xl border p-3 text-sm',
                preview ? 'border-primary/30 bg-primary/5' : 'border-dashed border-border',
              )}
            >
              Nueva fecha límite:{' '}
              <b className="text-slate-900">
                {preview ? formatLongDate(preview) : 'indica los días'}
              </b>
              <span className="text-muted-foreground">
                {' '}
                · disponibles: {available} días hábiles
              </span>
            </p>
            <Field label="Motivo de la ampliación" required>
              <Textarea
                value={values.extension.reason}
                onChange={(event) =>
                  update({ extension: { ...values.extension, reason: event.target.value } })
                }
                placeholder="El que se comunicó al peticionario en el oficio."
                className="min-h-20"
              />
            </Field>
          </div>
        )}

        {current === 'outcome' && (
          <div className="space-y-5">
            <SectionHeading
              title={values.outcome === 'transfer' ? 'Traslado y respuesta' : 'Respuesta'}
            >
              Escribe las fechas tal como aparecen en el radicado y en el envío.
            </SectionHeading>

            {values.outcome === 'transfer' && (
              <>
                {scope.transferDestination && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Entidad o dependencia destino" required>
                      <Input
                        value={values.transfer.destination}
                        onChange={(event) =>
                          update({
                            transfer: { ...values.transfer, destination: event.target.value },
                          })
                        }
                        placeholder="Ej. Secretaría de Planeación"
                      />
                    </Field>
                    <Field label="Motivo del traslado" required>
                      <Input
                        value={values.transfer.reason}
                        onChange={(event) =>
                          update({ transfer: { ...values.transfer, reason: event.target.value } })
                        }
                      />
                    </Field>
                  </div>
                )}
                <FilingFields
                  title="Oficio de traslado"
                  value={values.transfer.filing}
                  onChange={(filing) => update({ transfer: { ...values.transfer, filing } })}
                  minDate={context.entryDate}
                  existingDocument={existingDocuments.TRASLADO}
                  placeholder="Ej. 20262000321"
                />
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">
                      También se radicó la respuesta al ciudadano
                    </p>
                    <p className="text-muted-foreground">
                      Si aún no, el expediente queda en “Generar respuesta al ciudadano”.
                    </p>
                  </div>
                  <Switch
                    label="También se radicó la respuesta al ciudadano"
                    checked={values.citizenResponseSent}
                    onChange={(citizenResponseSent) => update({ citizenResponseSent })}
                  />
                </div>
              </>
            )}

            {(values.outcome === 'response' || values.citizenResponseSent) && (
              <FilingFields
                title={citizen ? 'Respuesta al ciudadano' : 'Respuesta radicada'}
                value={values.response}
                onChange={(response) => update({ response })}
                minDate={
                  values.outcome === 'transfer' && values.transfer.filing.date
                    ? values.transfer.filing.date
                    : context.entryDate
                }
                existingDocument={existingDocuments.RADICADO_SALIDA}
                placeholder="Ej. 20262000322"
              />
            )}

            <Field
              label="¿Quién proyectó y firmó?"
              hint="Si lo hizo otro compañero, el expediente quedará a su nombre y así constará en el historial y en el libro de radicación."
            >
              <Select
                value={respondedByUid}
                onChange={(event) => setRespondedByUid(event.target.value)}
              >
                <option value="">
                  {handler
                    ? `${handler.nombreCompleto} (responsable)`
                    : 'El responsable del trámite'}
                </option>
                {officials
                  .filter((entry) => entry.uid !== handler?.uid)
                  .map((entry) => (
                    <option key={entry.uid} value={entry.uid}>
                      Otro compañero: {entry.nombreCompleto}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
        )}

        {current === 'review' && renderReview()}
      </div>
    </Dialog>
  )

  // Se llama como función, no como componente, para no perder el foco al escribir.
  function renderReview() {
    const responseEvent = timeline.find((event) => event.label === 'Respuesta radicada')
    const transferEvent = timeline.find((event) => event.label === 'Traslado por competencia')
    const finalStatus =
      values.outcome === 'response' || (values.outcome === 'transfer' && values.citizenResponseSent)
        ? 'Archivo (Finalizado)'
        : values.outcome === 'transfer'
          ? 'Generar respuesta al ciudadano'
          : scope.receipt || scope.assignee
            ? 'En respuesta'
            : expedient.estado
    const finalHandler = input.respondedBy ?? handler
    return (
      <div className="space-y-5">
        {responseEvent && (
          <Alert
            tone={responseEvent.tone === 'success' ? 'success' : 'warning'}
            title={
              responseEvent.tone === 'success'
                ? 'La respuesta quedará dentro del término'
                : 'La respuesta quedará fuera del término'
            }
          >
            {responseEvent.tone === 'success'
              ? 'Se cuenta la fecha del radicado de respuesta, no la de este registro.'
              : `${responseEvent.detail}. Revisa las fechas: si están bien, se registra tal cual.`}
          </Alert>
        )}
        {transferEvent?.tone === 'warning' && (
          <Alert tone="warning" title={`Traslado después de ${TRANSFER_TERM_DAYS} días hábiles`}>
            El art. 21 de la Ley 1755 de 2015 pide trasladar dentro de los {TRANSFER_TERM_DAYS} días
            hábiles siguientes a la recepción. Se registra igual, con esta advertencia.
          </Alert>
        )}

        <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Línea de tiempo real</h3>
            <ol className="space-y-0">
              {timeline.map((event, index) => (
                <li key={`${event.label}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < timeline.length - 1 && (
                    <span className="absolute left-[0.3rem] top-4 h-[calc(100%-0.75rem)] w-px bg-border" />
                  )}
                  <span
                    className={cn(
                      'relative mt-1.5 size-2.5 shrink-0 rounded-full',
                      toneStyles[event.tone],
                    )}
                    aria-hidden="true"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">
                      {event.label}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {formatDate(event.date)}
                      </span>
                    </p>
                    {event.detail && (
                      <p
                        className={cn(
                          'text-xs',
                          event.tone === 'danger'
                            ? 'text-red-700'
                            : event.tone === 'warning'
                              ? 'text-amber-700'
                              : event.tone === 'success'
                                ? 'text-emerald-700'
                                : 'text-muted-foreground',
                        )}
                      >
                        {event.detail}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <h3 className="font-semibold text-slate-900">Qué se guardará</h3>
            <ul className="space-y-1.5 text-slate-700">
              {scope.receipt && <li>✓ Recepción confirmada con el formato firmado</li>}
              {input.assignee && <li>✓ Responsable: {input.assignee.nombreCompleto}</li>}
              {values.extensionEnabled && (
                <li>
                  ✓ Ampliación de {input.extension.requestedDays} días · radicado{' '}
                  {values.extension.filingNumber.trim()}
                </li>
              )}
              {values.outcome === 'transfer' && (
                <li>
                  ✓ Traslado{' '}
                  {values.transfer.destination.trim() && `a ${values.transfer.destination.trim()} `}
                  · radicado {values.transfer.filing.number.trim()}
                </li>
              )}
              {finalStatus === 'Archivo (Finalizado)' && (
                <li>✓ Respuesta · radicado {values.response.number.trim()}</li>
              )}
              {input.respondedBy && (
                <li>✓ Respondió otro compañero: {input.respondedBy.nombreCompleto}</li>
              )}
            </ul>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-muted-foreground">Queda en</span>
              <Badge variant={finalStatus === 'Archivo (Finalizado)' ? 'success' : 'brand'} dot>
                {finalStatus}
              </Badge>
            </div>
            {finalHandler && (
              <p className="text-muted-foreground">
                A nombre de <b className="text-slate-800">{finalHandler.nombreCompleto}</b>
              </p>
            )}
          </section>
        </div>

        <Field label="Observaciones" hint="Opcional. Quedan en el historial.">
          <Textarea
            value={values.notes}
            onChange={(event) => update({ notes: event.target.value })}
            className="min-h-16"
          />
        </Field>
      </div>
    )
  }
}
