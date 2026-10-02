import assert from 'node:assert/strict'
import test from 'node:test'
import { addBusinessDays, getRemainingBusinessDays } from './expedient-deadline'

test('calcula términos en días hábiles sin contar fines de semana', () => {
  const friday = new Date(2026, 6, 24)
  assert.equal(addBusinessDays(friday, 1).toDateString(), new Date(2026, 6, 27).toDateString())
})

test('excluye festivos configurados del término', () => {
  const friday = new Date(2026, 6, 24)
  assert.equal(addBusinessDays(friday, 1, ['2026-07-27']).toDateString(), new Date(2026, 6, 28).toDateString())
})

test('reporta días hábiles restantes incluyendo vencimiento', () => {
  assert.equal(getRemainingBusinessDays(new Date(2026, 6, 28), new Date(2026, 6, 24)), 2)
  assert.equal(getRemainingBusinessDays(new Date(2026, 6, 23), new Date(2026, 6, 24)), -1)
})

test('calcula diez días hábiles desde un lunes', () => {
  assert.equal(addBusinessDays(new Date(2026, 0, 5), 10).toDateString(), new Date(2026, 0, 19).toDateString())
})

test('cruza meses y años sin contar fines de semana', () => {
  assert.equal(addBusinessDays(new Date(2026, 11, 29), 3).toDateString(), new Date(2027, 0, 1).toDateString())
  assert.equal(addBusinessDays(new Date(2026, 0, 30), 2).toDateString(), new Date(2026, 1, 3).toDateString())
})

test('omite festivos consecutivos configurados', () => {
  assert.equal(addBusinessDays(new Date(2026, 3, 1), 2, ['2026-04-02', '2026-04-03']).toDateString(), new Date(2026, 3, 7).toDateString())
})
