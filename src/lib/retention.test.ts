import assert from 'node:assert/strict'
import test from 'node:test'
import { csvCell, toCsv } from './csv'
import { getRetentionStatus } from './retention'

const closed = new Date(2024, 2, 15)

test('sin TRD configurada no hay fechas de retención', () => {
  assert.deepEqual(getRetentionStatus(closed, undefined, undefined), { phase: 'Sin TRD' })
})

test('cuenta la retención en gestión desde el cierre', () => {
  const status = getRetentionStatus(closed, 2, 8, new Date(2025, 0, 1))
  assert.equal(status.phase, 'En archivo de gestión')
  assert.equal(status.transferDate?.toDateString(), new Date(2026, 2, 15).toDateString())
  assert.equal(status.dispositionDate?.toDateString(), new Date(2034, 2, 15).toDateString())
})

test('indica cuándo transferir y cuándo aplicar la disposición final', () => {
  assert.equal(
    getRetentionStatus(closed, 2, 8, new Date(2026, 2, 15)).phase,
    'Listo para transferencia',
  )
  assert.equal(
    getRetentionStatus(closed, 2, 8, new Date(2034, 2, 15)).phase,
    'Aplicar disposición final',
  )
  assert.equal(
    getRetentionStatus(closed, 2, undefined, new Date(2040, 0, 1)).phase,
    'Listo para transferencia',
  )
})

test('el CSV usa punto y coma y neutraliza fórmulas', () => {
  assert.equal(csvCell('=SUMA(A1)'), `"'=SUMA(A1)"`)
  assert.equal(csvCell('Dice "hola"'), '"Dice ""hola"""')
  assert.equal(toCsv(['A', 'B'], [[1, undefined]]), '"A";"B"\r\n"1";""')
})
