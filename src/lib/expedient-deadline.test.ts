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
