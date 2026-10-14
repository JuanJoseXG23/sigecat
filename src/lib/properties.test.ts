import assert from 'node:assert/strict'
import test from 'node:test'
import { getRegisteredProperties, hasPropertyData } from './properties'

test('un predio con solo el municipio no cuenta como registrado', () => {
  assert.equal(hasPropertyData({ municipio: 'Girardota' }), false)
  assert.equal(hasPropertyData({ municipio: 'Girardota', direccion: '  ' }), false)
  assert.equal(hasPropertyData({ numeroPredial: '053080001' }), true)
  assert.equal(hasPropertyData({ matriculaInmobiliaria: '012-34567' }), true)
  assert.equal(hasPropertyData({ direccion: 'Vereda El Totumo' }), true)
})

test('lista solo los predios con datos y tolera expedientes sin predios', () => {
  assert.deepEqual(getRegisteredProperties(undefined), [])
  assert.deepEqual(getRegisteredProperties([]), [])
  assert.deepEqual(
    getRegisteredProperties([{ municipio: 'Girardota' }, { numeroPredial: '1', municipio: 'X' }]),
    [{ numeroPredial: '1', municipio: 'X' }],
  )
})
