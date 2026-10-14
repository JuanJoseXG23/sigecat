import assert from 'node:assert/strict'
import test from 'node:test'
import { ALL_YEARS, getYearBounds, getYearOptions, parseYear } from './periods'

test('el rango de un año va del 1 de enero al 1 de enero siguiente', () => {
  assert.deepEqual(getYearBounds(2026), [new Date(2026, 0, 1), new Date(2027, 0, 1)])
})

test('los años van del actual al del primer registro', () => {
  const today = new Date(2026, 9, 14)
  assert.deepEqual(getYearOptions(2024, today), [2026, 2025, 2024])
  assert.deepEqual(getYearOptions(undefined, today), [2026])
  // Un registro con fecha futura no agrega años que aún no existen.
  assert.deepEqual(getYearOptions(2027, today), [2026])
})

test('el selector distingue un año de todo el archivo', () => {
  assert.equal(parseYear('2025'), 2025)
  assert.equal(parseYear(ALL_YEARS), undefined)
})
