import { z } from 'zod'
import { APPLICANT_TYPES, EXPEDIENT_PRIORITIES, EXPEDIENT_STATUSES } from '@/types/expedient'

const optionalText = z.string().trim().optional()

export const expedientSchema = z.object({
  numeroRadicado: z.string().trim().min(1, 'Ingresa el número de radicado.'),
  fechaRadicado: z.string().min(1, 'Selecciona la fecha de radicado.'),
  fechaRecibido: optionalText,
  medioIngreso: optionalText,
  tipoTramite: optionalText,
  solicitantes: z
    .array(
      z.object({
        nombre: optionalText,
        documento: optionalText,
        telefono: optionalText,
        correo: z.string().trim().email('Ingresa un correo válido.').or(z.literal('')).optional(),
        tipoSolicitante: z.enum(APPLICANT_TYPES).optional(),
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
  estado: z.enum(EXPEDIENT_STATUSES).optional(),
  prioridad: z.enum(EXPEDIENT_PRIORITIES).optional(),
  fechaLimite: optionalText,
  diasRestantes: z.coerce.number().int().optional(),
  observacionesIniciales: optionalText,
})
