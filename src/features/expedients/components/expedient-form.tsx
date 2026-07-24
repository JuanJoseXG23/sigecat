import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch, type SubmitHandler } from 'react-hook-form'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { expedientSchema } from '@/features/expedients/schemas/expedient-schema'
import { calculateExpedientTimeline } from '@/lib/expedient-deadline'
import { useProcedureTypes } from '@/hooks/use-procedure-types'
import type { Expedient, ExpedientFormData } from '@/types/expedient'
import { APPLICANT_TYPES, EXPEDIENT_PRIORITIES, EXPEDIENT_STATUSES } from '@/types/expedient'
import type { UserProfile } from '@/types/user'

type FormValues = z.infer<typeof expedientSchema>

interface ExpedientFormProps {
  expedient?: Expedient
  officials: UserProfile[]
  isSaving: boolean
  onCancel: () => void
  onSubmit: (values: ExpedientFormData) => Promise<void>
}

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
  return value.toDate().toISOString().slice(0, 10)
}

function getDefaultValues(expedient?: Expedient): FormValues {
  return {
    numeroRadicado: expedient?.numeroRadicado ?? '',
    fechaRadicado: toDateInput(expedient?.fechaRadicado),
    fechaRecibido: toDateInput(expedient?.fechaRecibido),
    medioIngreso: expedient?.medioIngreso ?? '',
    tipoTramiteId: expedient?.tipoTramiteId ?? '',
    tipoTramite: expedient?.tipoTramite ?? '',
    solicitantes: expedient?.solicitantes.length ? expedient.solicitantes : [emptyApplicant],
    predios: expedient?.predios.length ? expedient.predios : [emptyProperty],
    funcionarioAsignadoUid: expedient?.funcionarioAsignado?.uid ?? '',
    estado: expedient?.estado ?? 'Recibido',
    prioridad: expedient?.prioridad,
    observacionesIniciales: expedient?.observacionesIniciales ?? '',
  }
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function ExpedientForm({
  expedient,
  officials,
  isSaving,
  onCancel,
  onSubmit,
}: ExpedientFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(expedientSchema),
    defaultValues: getDefaultValues(expedient),
    mode: 'onSubmit',
  })
  const applicants = useFieldArray({ control: form.control, name: 'solicitantes' })
  const filingDate = useWatch({ control: form.control, name: 'fechaRadicado' })
  const procedureTypeId = useWatch({ control: form.control, name: 'tipoTramiteId' })
  const { data: procedureTypes = [] } = useProcedureTypes()
  const selectedType = procedureTypes.find((item) => item.id === procedureTypeId)
  const timeline = filingDate && selectedType ? calculateExpedientTimeline(filingDate, selectedType.diasRespuesta) : undefined

  useEffect(() => {
    form.reset(getDefaultValues(expedient))
  }, [expedient, form])

  const submit: SubmitHandler<FormValues> = async (values) => {
    await onSubmit(values)
  }

  return (
    <form className="space-y-7" onSubmit={form.handleSubmit(submit)} noValidate>
      <FormSection title="Información general">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número de radicado *">
            <Input placeholder="Ej. 2026-00125" {...form.register('numeroRadicado')} />
            {form.formState.errors.numeroRadicado && (
              <span className="text-xs font-normal text-destructive">
                {form.formState.errors.numeroRadicado.message}
              </span>
            )}
          </Field>
          <Field label="Fecha de radicado *">
            <Input type="date" {...form.register('fechaRadicado')} />
            {form.formState.errors.fechaRadicado && (
              <span className="text-xs font-normal text-destructive">
                {form.formState.errors.fechaRadicado.message}
              </span>
            )}
            {timeline && (
              <span className="block text-xs font-normal text-slate-500">
                Fecha límite calculada: {timeline.fechaLimite.toLocaleDateString('es-CO')}
              </span>
            )}
          </Field>
          <Field label="Fecha de recibido">
            <Input type="date" {...form.register('fechaRecibido')} />
          </Field>
          <Field label="Medio de ingreso">
            <Input placeholder="Ej. Ventanilla, correo" {...form.register('medioIngreso')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Solicitantes">
        <div className="space-y-3">
          {applicants.fields.map((field, index) => (
            <Card key={field.id} className="relative p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">Solicitante {index + 1}</p>
                {applicants.fields.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => applicants.remove(index)}
                    aria-label={`Eliminar solicitante ${index + 1}`}
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre">
                  <Input {...form.register(`solicitantes.${index}.nombre`)} />
                </Field>
                <Field label="Tipo de solicitante">
                  <Select {...form.register(`solicitantes.${index}.tipoSolicitante`)}>
                    <option value="">Selecciona una opción</option>
                    {APPLICANT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Documento">
                  <Input {...form.register(`solicitantes.${index}.documento`)} />
                </Field>
                <Field label="Teléfono">
                  <Input {...form.register(`solicitantes.${index}.telefono`)} />
                </Field>
                <Field label="Correo">
                  <Input type="email" {...form.register(`solicitantes.${index}.correo`)} />
                </Field>
              </div>
              {form.formState.errors.solicitantes?.[index]?.correo && (
                <span className="mt-2 block text-xs text-destructive">
                  {form.formState.errors.solicitantes[index].correo?.message}
                </span>
              )}
            </Card>
          ))}
        </div>
        <Button variant="outline" type="button" onClick={() => applicants.append(emptyApplicant)}>
          <Plus size={16} /> Agregar solicitante
        </Button>
      </FormSection>

      <FormSection title="Información predial">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Municipio">
            <Input {...form.register('predios.0.municipio')} />
          </Field>
          <Field label="Número predial">
            <Input {...form.register('predios.0.numeroPredial')} />
          </Field>
          <Field label="Matrícula inmobiliaria">
            <Input {...form.register('predios.0.matriculaInmobiliaria')} />
          </Field>
          <Field label="Dirección">
            <Input {...form.register('predios.0.direccion')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Gestión">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de trámite">
            <Select {...form.register('tipoTramiteId')}>
              <option value="">Sin tipo configurado</option>
              {procedureTypes.map((type) => <option key={type.id} value={type.id}>{type.nombre} · {type.diasRespuesta} días hábiles</option>)}
            </Select>
            {selectedType && <span className="block text-xs font-normal text-slate-500">Flujo: {selectedType.flujoEstados.join(' → ')}</span>}
          </Field>
          <Field label="Funcionario responsable">
            <Select {...form.register('funcionarioAsignadoUid')}>
              <option value="">Sin asignar</option>
              {officials.map((official) => (
                <option key={official.uid} value={official.uid}>
                  {official.nombreCompleto} · {official.rol}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select {...form.register('estado')}>
              {(selectedType?.flujoEstados ?? EXPEDIENT_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {status}
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
        </div>
        <Field label="Observaciones iniciales">
          <Textarea {...form.register('observacionesIniciales')} />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : expedient ? 'Guardar cambios' : 'Crear expediente'}
        </Button>
      </div>
    </form>
  )
}
