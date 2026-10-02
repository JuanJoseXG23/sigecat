import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarCheck2, Plus, Trash2 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useFieldArray, useForm, useWatch, type SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { expedientSchema } from '@/features/expedients/schemas/expedient-schema'
import { calculateExpedientTimeline, toDateKey } from '@/lib/expedient-deadline'
import { describeRemainingDays, formatLongDate } from '@/lib/format'
import { useBusinessConfiguration } from '@/hooks/use-business-configuration'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import type { Expedient, ExpedientFormData } from '@/types/expedient'
import { APPLICANT_TYPES, EXPEDIENT_PRIORITIES } from '@/types/expedient'

type FormInput = z.input<typeof expedientSchema>
type FormValues = z.output<typeof expedientSchema>

interface ExpedientFormProps {
  expedient?: Expedient
  isSaving: boolean
  onCancel: () => void
  onSubmit: (values: ExpedientFormData) => Promise<void>
}

const INTAKE_CHANNELS = [
  'Ventanilla única',
  'Correo electrónico',
  'Sede electrónica',
  'Correo certificado',
  'Atención telefónica',
]

const emptyApplicant = {
  nombre: '',
  documento: '',
  telefono: '',
  correo: '',
  tipoSolicitante: undefined,
}
const emptyProperty = {
  municipio: 'Girardota',
  numeroPredial: '',
  matriculaInmobiliaria: '',
  direccion: '',
}

function toDateInput(value?: { toDate: () => Date }): string {
  if (!value) return ''
  return toDateKey(value.toDate())
}

function getDefaultValues(expedient?: Expedient): FormInput {
  return {
    numeroRadicado: expedient?.numeroRadicado ?? '',
    fechaRadicado: expedient ? toDateInput(expedient.fechaRadicado) : toDateKey(new Date()),
    fechaRecibido: toDateInput(expedient?.fechaRecibido),
    medioIngreso: expedient?.medioIngreso ?? '',
    tipoTramiteId: expedient?.tipoTramiteId ?? '',
    tipoTramite: expedient?.tipoTramite ?? '',
    asunto: expedient?.asunto ?? '',
    solicitantes: expedient?.solicitantes.length ? expedient.solicitantes : [emptyApplicant],
    predios: expedient?.predios.length ? expedient.predios : [emptyProperty],
    funcionarioAsignadoUid: expedient?.funcionarioAsignado?.uid ?? '',
    prioridad: expedient?.prioridad,
    observacionesIniciales: expedient?.observacionesIniciales ?? '',
  }
}

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <div className="flex gap-3 lg:block">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary lg:mb-2">
          {step}
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  )
}

function RepeatableCard({
  title,
  onRemove,
  children,
}: {
  title: string
  onRemove?: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {onRemove && (
          <Button variant="ghost-destructive" size="sm" onClick={onRemove}>
            <Trash2 size={15} /> Quitar
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export function ExpedientForm({ expedient, isSaving, onCancel, onSubmit }: ExpedientFormProps) {
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(expedientSchema),
    defaultValues: getDefaultValues(expedient),
    mode: 'onSubmit',
  })
  const errors = form.formState.errors
  const applicants = useFieldArray({ control: form.control, name: 'solicitantes' })
  const properties = useFieldArray({ control: form.control, name: 'predios' })
  const filingDate = useWatch({ control: form.control, name: 'fechaRadicado' })
  const procedureTypeId = useWatch({ control: form.control, name: 'tipoTramiteId' })
  const { data: procedureTypes = [] } = useProcedureTypes()
  const { data: configuration } = useBusinessConfiguration()
  const selectedType = procedureTypes.find((item) => item.id === procedureTypeId)
  const extensionDays = expedient?.diasAmpliacion ?? 0
  const timeline =
    filingDate && selectedType
      ? calculateExpedientTimeline(
          filingDate,
          selectedType.diasRespuesta + extensionDays,
          new Date(),
          configuration?.diasFestivos,
        )
      : undefined

  useEffect(() => {
    form.reset(getDefaultValues(expedient))
  }, [expedient, form])

  const submit: SubmitHandler<FormValues> = async (values) => {
    await onSubmit(values)
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(submit)} noValidate>
      <FormSection
        step={1}
        title="Radicación"
        description="Datos del radicado de entrada tal como aparecen en el sello o planilla."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número de radicado" required error={errors.numeroRadicado?.message}>
            <Input placeholder="Ej. 2026-00125" {...form.register('numeroRadicado')} />
          </Field>
          <Field label="Fecha de radicado" required error={errors.fechaRadicado?.message}>
            <Input type="date" max={toDateKey(new Date())} {...form.register('fechaRadicado')} />
          </Field>
          <Field label="Fecha de recibido" hint="Informativa; no modifica el término.">
            <Input type="date" {...form.register('fechaRecibido')} />
          </Field>
          <Field label="Medio de ingreso">
            <Input
              list="intake-channels"
              placeholder="Selecciona o escribe"
              {...form.register('medioIngreso')}
            />
            <datalist id="intake-channels">
              {INTAKE_CHANNELS.map((channel) => (
                <option key={channel} value={channel} />
              ))}
            </datalist>
          </Field>
        </div>
      </FormSection>

      <FormSection
        step={2}
        title="Trámite y término"
        description="El tipo de trámite define los días hábiles de respuesta."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de trámite" required error={errors.tipoTramiteId?.message}>
            <Select {...form.register('tipoTramiteId')}>
              <option value="">Selecciona el trámite</option>
              {procedureTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.nombre} · {type.diasRespuesta} días hábiles
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prioridad">
            <Select {...form.register('prioridad')}>
              <option value="">Sin prioridad</option>
              {EXPEDIENT_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Asunto"
            className="sm:col-span-2"
            hint="Resumen corto de lo que se solicita."
          >
            <Input
              placeholder="Ej. Rectificación de área del predio"
              {...form.register('asunto')}
            />
          </Field>
        </div>
        {timeline && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <CalendarCheck2 size={20} className="mt-0.5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-semibold text-slate-900">
                Fecha límite: <span>{formatLongDate(timeline.fechaLimite)}</span>
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {selectedType?.diasRespuesta} días hábiles
                {extensionDays ? ` + ${extensionDays} de ampliación` : ''}, sin sábados, domingos ni
                festivos de Colombia. {describeRemainingDays(timeline.diasRestantes)}.
              </p>
            </div>
          </div>
        )}
      </FormSection>

      <FormSection
        step={3}
        title="Solicitantes"
        description="Personas que presentan la petición y a quienes se dirige la respuesta."
      >
        {applicants.fields.map((field, index) => (
          <RepeatableCard
            key={field.id}
            title={`Solicitante ${index + 1}`}
            onRemove={applicants.fields.length > 1 ? () => applicants.remove(index) : undefined}
          >
            <Field label="Nombre completo">
              <Input {...form.register(`solicitantes.${index}.nombre`)} />
            </Field>
            <Field label="Calidad en que actúa">
              <Select {...form.register(`solicitantes.${index}.tipoSolicitante`)}>
                <option value="">Selecciona una opción</option>
                {APPLICANT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Documento de identidad">
              <Input inputMode="numeric" {...form.register(`solicitantes.${index}.documento`)} />
            </Field>
            <Field label="Teléfono">
              <Input type="tel" {...form.register(`solicitantes.${index}.telefono`)} />
            </Field>
            <Field
              label="Correo para notificaciones"
              className="sm:col-span-2"
              error={errors.solicitantes?.[index]?.correo?.message}
            >
              <Input type="email" {...form.register(`solicitantes.${index}.correo`)} />
            </Field>
          </RepeatableCard>
        ))}
        <Button variant="outline" size="sm" onClick={() => applicants.append(emptyApplicant)}>
          <Plus size={16} /> Agregar solicitante
        </Button>
      </FormSection>

      <FormSection step={4} title="Predios" description="Identificación catastral y registral.">
        {properties.fields.map((field, index) => (
          <RepeatableCard
            key={field.id}
            title={`Predio ${index + 1}`}
            onRemove={properties.fields.length > 1 ? () => properties.remove(index) : undefined}
          >
            <Field label="Número predial">
              <Input {...form.register(`predios.${index}.numeroPredial`)} />
            </Field>
            <Field label="Matrícula inmobiliaria">
              <Input
                placeholder="Ej. 012-34567"
                {...form.register(`predios.${index}.matriculaInmobiliaria`)}
              />
            </Field>
            <Field label="Dirección o vereda">
              <Input {...form.register(`predios.${index}.direccion`)} />
            </Field>
            <Field label="Municipio">
              <Input {...form.register(`predios.${index}.municipio`)} />
            </Field>
          </RepeatableCard>
        ))}
        <Button variant="outline" size="sm" onClick={() => properties.append(emptyProperty)}>
          <Plus size={16} /> Agregar predio
        </Button>
      </FormSection>

      <FormSection step={5} title="Observaciones">
        <Field label="Observaciones iniciales">
          <Textarea {...form.register('observacionesIniciales')} />
        </Field>
      </FormSection>

      <div className="sticky -bottom-5 -mx-5 flex flex-col-reverse gap-2 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : expedient ? 'Guardar cambios' : 'Radicar expediente'}
        </Button>
      </div>
    </form>
  )
}
