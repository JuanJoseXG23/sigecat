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
