import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAvailableExtensionDays,
  getExtensionError,
  planExtension,
  type ExtensionContext,
  type ExtensionInput,
} from './deadline-extension'

const context: ExtensionContext = {
  entryDate: '2026-09-01',
  // Término de 15 días hábiles: vence el martes 22 de septiembre de 2026.
  currentDeadline: new Date(2026, 8, 22),
  responseDays: 15,
  previousExtensionDays: 0,
  today: new Date(2026, 8, 18),
}

const valid: ExtensionInput = {
  filingNumber: ' S-2026-0450 ',
  filingDate: '2026-09-18',
  requestedDays: 10,
  reason: 'Se requiere visita técnica al predio.',
  documentName: 'Oficio ampliación de plazo',
  documentUrl: 'https://girardota.sharepoint.com/oficio.pdf',
}

test('acepta una ampliación comunicada antes del vencimiento', () => {
  assert.equal(getExtensionError(valid, context), null)
})

test('exige el radicado escaneado de la solicitud', () => {
  assert.match(getExtensionError({ ...valid, documentUrl: '' }, context)!, /radicado escaneado/)
  assert.match(
    getExtensionError({ ...valid, documentUrl: 'https://drive.google.com/x' }, context)!,
    /OneDrive/,
  )
})

test('exige número, fecha, días y motivo', () => {
  assert.match(getExtensionError({ ...valid, filingNumber: ' ' }, context)!, /número y la fecha/)
  assert.match(getExtensionError({ ...valid, requestedDays: 0 }, context)!, /cuántos días/)
  assert.match(getExtensionError({ ...valid, requestedDays: 2.5 }, context)!, /cuántos días/)
  assert.match(getExtensionError({ ...valid, reason: '' }, context)!, /motivo/)
})

test('no permite ampliar después de vencido el término', () => {
  assert.match(
    getExtensionError(
      { ...valid, filingDate: '2026-09-23' },
      { ...context, today: new Date(2026, 8, 25) },
    )!,
    /antes de que venza/,
  )
})

test('rechaza fechas futuras o anteriores a la radicación', () => {
  assert.match(getExtensionError({ ...valid, filingDate: '2026-09-21' }, context)!, /futura/)
  assert.match(getExtensionError({ ...valid, filingDate: '2026-08-31' }, context)!, /anterior/)
})

test('limita la ampliación al doble del término inicial, sumando las anteriores', () => {
  assert.equal(getAvailableExtensionDays(context), 30)
  assert.equal(getAvailableExtensionDays({ ...context, previousExtensionDays: 25 }), 5)
  assert.match(getExtensionError({ ...valid, requestedDays: 31 }, context)!, /máximo 30/)
  assert.match(
    getExtensionError(valid, { ...context, previousExtensionDays: 30 })!,
    /toda la ampliación/,
  )
})

test('calcula la nueva fecha límite en días hábiles desde la fecha límite actual', () => {
  // Diez días hábiles después del 22 de septiembre: 6 de octubre de 2026.
  const plan = planExtension(valid, context)
  assert.equal(plan.newDeadline.toDateString(), new Date(2026, 9, 6).toDateString())
  assert.equal(plan.totalExtensionDays, 10)
  // El festivo del Día de la Raza (12 de octubre) no cuenta.
  const later = planExtension(
    { ...valid, requestedDays: 5 },
    {
      ...context,
      currentDeadline: new Date(2026, 9, 7),
      today: new Date(2026, 9, 7),
      previousExtensionDays: 10,
    },
  )
  assert.equal(later.newDeadline.toDateString(), new Date(2026, 9, 15).toDateString())
  assert.equal(later.totalExtensionDays, 15)
  assert.throws(() => planExtension({ ...valid, reason: '' }, context))
})
