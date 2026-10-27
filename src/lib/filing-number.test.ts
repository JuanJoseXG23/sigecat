import assert from 'node:assert/strict'
import test from 'node:test'
import { getFilingNumberError } from './filing-number'

test('acepta año, serie y consecutivo de 4 cifras o más', () => {
  assert.equal(getFilingNumberError(' 20261000123 ', '2026-10-13', 'entrada'), null)
  assert.equal(getFilingNumberError('20262000456', '2026-10-13', 'salida'), null)
  assert.equal(getFilingNumberError('202620012345', '2026-10-13', 'salida'), null)
})

test('rechaza formatos que no son de Archivo', () => {
  assert.match(getFilingNumberError('E-100', '2026-10-13', 'entrada')!, /20261000001/)
  assert.match(getFilingNumberError('2026100123', '2026-10-13', 'entrada')!, /solo números/)
  assert.match(
    getFilingNumberError('20263000123', '2026-10-13', 'salida')!,
    /serie del radicado debe ser 200/,
  )
})

test('distingue entrada de salida', () => {
  assert.match(getFilingNumberError('20262000123', '2026-10-13', 'entrada')!, /de salida/)
  assert.match(getFilingNumberError('20261000123', '2026-10-13', 'salida')!, /de entrada/)
})

test('el año del radicado coincide con su fecha', () => {
  assert.match(getFilingNumberError('20251000123', '2026-01-02', 'entrada')!, /2025.*2026/)
  assert.equal(getFilingNumberError('20251000123', '2025-12-30', 'entrada'), null)
})

test('entrada interna: año, guion y 6 cifras o más', () => {
  assert.equal(getFilingNumberError('2026-000123', '2026-10-27', 'entrada', 'Interna'), null)
  assert.equal(getFilingNumberError('2026-1234567', '2026-10-27', 'entrada', 'Interna'), null)
  assert.match(
    getFilingNumberError('2026-12345', '2026-10-27', 'entrada', 'Interna')!,
    /2026-000001/,
  )
  assert.match(getFilingNumberError('20261000123', '2026-10-27', 'entrada', 'Interna')!, /Externa/)
  assert.match(
    getFilingNumberError('2025-000123', '2026-01-02', 'entrada', 'Interna')!,
    /2025.*2026/,
  )
})

test('un número interno en un expediente externo sugiere la clase Interna', () => {
  assert.match(getFilingNumberError('2026-000123', '2026-10-27', 'entrada')!, /Interna/)
})

test('la salida de un interno acepta los dos formatos', () => {
  assert.equal(getFilingNumberError('2026-000456', '2026-10-27', 'salida', 'Interna'), null)
  assert.equal(getFilingNumberError('20262000456', '2026-10-27', 'salida', 'Interna'), null)
  assert.match(
    getFilingNumberError('20261000456', '2026-10-27', 'salida', 'Interna')!,
    /de entrada/,
  )
  assert.match(
    getFilingNumberError('2026-000456', '2026-10-27', 'salida')!,
    /externa: lo que se envía usa la serie 200/,
  )
})
