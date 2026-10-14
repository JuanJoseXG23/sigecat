/**
 * Fechas del radicado de entrada (yyyy-mm-dd). El radicado no puede ser futuro, y la fecha de
 * recibido, que es informativa, no puede ser anterior al radicado ni futura.
 */
export function getEntryDatesError(
  filingDate: string,
  receivedDate: string | undefined,
  today: string,
): { field: 'fechaRadicado' | 'fechaRecibido'; message: string } | null {
  if (filingDate > today)
    return { field: 'fechaRadicado', message: 'La fecha de radicado no puede ser futura.' }
  if (!receivedDate) return null
  if (receivedDate < filingDate)
    return {
      field: 'fechaRecibido',
      message: 'La fecha de recibido no puede ser anterior a la de radicado.',
    }
  if (receivedDate > today)
    return { field: 'fechaRecibido', message: 'La fecha de recibido no puede ser futura.' }
  return null
}
