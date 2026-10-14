import assert from 'node:assert/strict'
import test from 'node:test'
import { getEntryDatesError } from './entry-dates'

const today = '2026-10-14'

test('acepta radicado de hoy o pasado y recibido entre el radicado y hoy', () => {
  assert.equal(getEntryDatesError('2026-10-14', undefined, today), null)
  assert.equal(getEntryDatesError('2026-10-07', '2026-10-07', today), null)
  assert.equal(getEntryDatesError('2026-10-07', '2026-10-13', today), null)
})

test('rechaza fechas futuras y recibido anterior al radicado', () => {
  assert.equal(getEntryDatesError('2026-10-15', undefined, today)?.field, 'fechaRadicado')
  assert.match(getEntryDatesError('2026-10-07', '2026-10-06', today)!.message, /anterior/)
  assert.match(getEntryDatesError('2026-10-07', '2026-10-15', today)!.message, /futura/)
})
