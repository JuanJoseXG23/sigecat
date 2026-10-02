import assert from 'node:assert/strict'
import test from 'node:test'
import { getColombianHolidays, getEasterSunday, isColombianHoliday } from './colombian-holidays'

test('calcula el domingo de Pascua', () => {
  assert.equal(getEasterSunday(2025).toDateString(), new Date(2025, 3, 20).toDateString())
  assert.equal(getEasterSunday(2026).toDateString(), new Date(2026, 3, 5).toDateString())
  assert.equal(getEasterSunday(2027).toDateString(), new Date(2027, 2, 28).toDateString())
})

test('genera los 18 festivos oficiales de 2026', () => {
  assert.deepEqual(
    getColombianHolidays(2026).map((holiday) => holiday.date),
    [
      '2026-01-01',
      '2026-01-12',
      '2026-03-23',
      '2026-04-02',
      '2026-04-03',
      '2026-05-01',
      '2026-05-18',
      '2026-06-08',
      '2026-06-15',
      '2026-06-29',
      '2026-07-20',
      '2026-08-07',
      '2026-08-17',
      '2026-10-12',
      '2026-11-02',
      '2026-11-16',
      '2026-12-08',
      '2026-12-25',
    ],
  )
})

test('traslada a lunes los festivos de la Ley Emiliani', () => {
  const holidays = getColombianHolidays(2025)
  const byName = (name: string) => holidays.find((holiday) => holiday.name.includes(name))?.date
  assert.equal(byName('Día de los Reyes Magos'), '2025-01-06')
  assert.equal(byName('Día de San José'), '2025-03-24')
  assert.equal(byName('Ascensión del Señor'), '2025-06-02')
  assert.equal(byName('Corpus Christi'), '2025-06-23')
  assert.equal(byName('Sagrado Corazón de Jesús'), '2025-06-30')
  assert.equal(byName('Todos los Santos'), '2025-11-03')
})

test('reconoce festivos sin configurarlos', () => {
  assert.equal(isColombianHoliday('2026-07-20'), true)
  assert.equal(isColombianHoliday('2026-07-21'), false)
  assert.equal(isColombianHoliday('2027-03-25'), true)
})
