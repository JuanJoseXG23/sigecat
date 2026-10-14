import { z } from 'zod'
import { getFilingNumberError } from '@/lib/filing-number'
import { APPLICANT_TYPES, EXPEDIENT_PRIORITIES } from '@/types/expedient'

const optionalText = z.string().trim().optional()

export const expedientSchema = z.object({
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
 * Valida el formato del radicado de entrada si el expediente es nuevo o si el número cambia;
 * los expedientes antiguos con otro formato se pueden seguir editando.
 */
export function createExpedientSchema(previousNumber?: string) {
  return expedientSchema.superRefine((values, context) => {
    if (values.numeroRadicado === previousNumber?.trim()) return
    const error = getFilingNumberError(values.numeroRadicado, values.fechaRadicado, 'entrada')
    if (error)
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['numeroRadicado'], message: error })
  })
}
