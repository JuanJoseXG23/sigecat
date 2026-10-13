/**
 * Preguntas de la jefatura al responsable de un expediente. La aplicación solo deja la
 * solicitud con identificadores y el texto; Apps Script lee el correo del destinatario y lo
 * envía desde la cuenta institucional, con respuesta directa a quien preguntó.
 */

export const INQUIRY_MIN_LENGTH = 5
export const INQUIRY_MAX_LENGTH = 1000

/** Preguntas frecuentes para no tener que escribirlas cada vez. */
export const INQUIRY_TEMPLATES = [
  '¿En qué va este trámite y qué falta para responderlo?',
  '¿Cuándo se radicará la respuesta al ciudadano?',
  'Este expediente está vencido o próximo a vencer: ¿cuál es el plan para responderlo?',
  '¿Necesitas apoyo para responder dentro del término?',
]

/** Primer problema de la pregunta, o null si se puede enviar. */
export function getInquiryError(
  question: string,
  recipient?: { uid: string } | null,
): string | null {
  if (!recipient)
    return 'El expediente no tiene responsable: asígnalo antes de preguntar o consulta a Coordinación.'
  const text = question.trim()
  if (text.length < INQUIRY_MIN_LENGTH) return 'Escribe la pregunta.'
  if (text.length > INQUIRY_MAX_LENGTH)
    return `La pregunta no puede superar ${INQUIRY_MAX_LENGTH} caracteres.`
  return null
}
