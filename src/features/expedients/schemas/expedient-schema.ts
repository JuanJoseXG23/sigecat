import { z } from 'zod'
import { CORRESPONDENCE_CLASSES, type CorrespondenceClass } from '@/lib/correspondence'
import { DEPENDENCIES, type DependencyId } from '@/lib/dependencies'
import { getEntryDatesError } from '@/lib/entry-dates'
import { toDateKey } from '@/lib/expedient-deadline'
import { getFilingNumberError } from '@/lib/filing-number'
import { APPLICANT_TYPES, EXPEDIENT_PRIORITIES } from '@/types/expedient'

const optionalText = z.string().trim().optional()

const dependencyIds = DEPENDENCIES.map((item) => item.id) as [DependencyId, ...DependencyId[]]

export const expedientSchema = z.object({
  dependencia: z.enum(dependencyIds, { message: 'Selecciona el área.' }),
  clase: z.enum(CORRESPONDENCE_CLASSES, { message: 'Selecciona la clase de correspondencia.' }),
  numeroRadicado: z.string().trim().min(1, 'Ingresa el número de radicado.'),
  fechaRadicado: z.string().min(1, 'Selecciona la fecha de radicado.'),
  fechaRecibido: optionalText,
  medioIngreso: optionalText,
  tipoTramiteId: z.string().trim().min(1, 'Selecciona un tipo de trámite.'),
  tipoTramite: optionalText,
  asunto: optionalText,
  solicitantes: z
    .array(
      z.object({
        nombre: optionalText,
        documento: optionalText,
        telefono: optionalText,
        correo: z.string().trim().email('Ingresa un correo válido.').or(z.literal('')).optional(),
        tipoSolicitante: z.preprocess(
          (value) => (value === '' ? undefined : value),
          z.enum(APPLICANT_TYPES).optional(),
        ),
      }),
    )
    .min(1, 'Registra al menos un solicitante.'),
  predios: z.array(
    z.object({
      municipio: optionalText,
      numeroPredial: optionalText,
      matriculaInmobiliaria: optionalText,
      direccion: optionalText,
    }),
  ),
  funcionarioAsignadoUid: optionalText,
  prioridad: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(EXPEDIENT_PRIORITIES).optional(),
  ),
  observacionesIniciales: optionalText,
})

/**
 * Valida las fechas y, si el expediente es nuevo o cambian el número o la clase, el formato del
 * radicado de entrada; los expedientes antiguos con otro formato se pueden seguir editando. En la
 * correspondencia interna el remitente es obligatorio: sin documento, es lo que la identifica.
 */
export function createExpedientSchema(previous?: {
  numeroRadicado: string
  clase: CorrespondenceClass
}) {
  return expedientSchema.superRefine((values, context) => {
    const dates = getEntryDatesError(
      values.fechaRadicado,
      values.fechaRecibido || undefined,
      toDateKey(new Date()),
    )
    if (dates)
      context.addIssue({ code: z.ZodIssueCode.custom, path: [dates.field], message: dates.message })
    if (values.clase === 'Interna' && !values.solicitantes[0]?.nombre)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['solicitantes', 0, 'nombre'],
        message: 'Escribe la dependencia o funcionario remitente.',
      })
    if (
      values.numeroRadicado === previous?.numeroRadicado.trim() &&
      values.clase === previous.clase
    )
      return
    const error = getFilingNumberError(
      values.numeroRadicado,
      values.fechaRadicado,
      'entrada',
      values.clase,
    )
    if (error)
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['numeroRadicado'], message: error })
  })
}
