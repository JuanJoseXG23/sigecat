import assert from 'node:assert/strict'
import test from 'node:test'
import { csvCell, toCsv } from './csv'

test('el CSV usa punto y coma y neutraliza fórmulas', () => {
  assert.equal(csvCell('=SUMA(A1)'), `"'=SUMA(A1)"`)
  assert.equal(csvCell('Dice "hola"'), '"Dice ""hola"""')
  assert.equal(toCsv(['A', 'B'], [[1, undefined]]), '"A";"B"\r\n"1";""')
})
