import assert from 'node:assert/strict'
import test from 'node:test'
import {
  detectCorrespondenceClass,
  getCorrespondenceClass,
  matchesCorrespondence,
} from './correspondence'

test('sin clase es externa', () => {
  assert.equal(getCorrespondenceClass({}), 'Externa')
  assert.equal(getCorrespondenceClass({ clase: 'Interna' }), 'Interna')
  assert.equal(getCorrespondenceClass({ clase: 'otra' }), 'Externa')
})

test('detecta la clase por el formato', () => {
  assert.equal(detectCorrespondenceClass(' 2026-000123 '), 'Interna')
  assert.equal(detectCorrespondenceClass('20261000123'), 'Externa')
  assert.equal(detectCorrespondenceClass('2026-'), 'Interna')
  assert.equal(detectCorrespondenceClass('abc'), undefined)
})

test('filtra por clase', () => {
  assert.equal(matchesCorrespondence({}, 'Externa'), true)
  assert.equal(matchesCorrespondence({ clase: 'Interna' }, 'Externa'), false)
  assert.equal(matchesCorrespondence({ clase: 'Interna' }, ''), true)
})
