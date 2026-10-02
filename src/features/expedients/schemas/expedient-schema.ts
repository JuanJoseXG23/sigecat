import { z } from 'zod'
import { ACCESS_LEVELS, APPLICANT_TYPES, EXPEDIENT_PRIORITIES } from '@/types/expedient'

const optionalText = z.string().trim().optional()

export const expedientSchema = z.object({
  numeroRadicado: z.string().trim().min(1, 'Ingresa el número de radicado.'),
  fechaRadicado: z.string().min(1, 'Selecciona la fecha de radicado.'),
  fechaRecibido: optionalText,
  medioIngreso: optionalText,
  tipoTramiteId: z.string().trim().min(1, 'Selecciona un tipo de trámite.'),
  tipoTramite: optionalText,
  asunto: optionalText,
  nivelAcceso: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(ACCESS_LEVELS).optional(),
  ),
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
