import assert from 'node:assert/strict'
import test from 'node:test'
import { describeResponseSupport, getResponseSupportError } from './response-support'

const valid = {
  dependencia: 'tesoreria',
  persona: ' Ana Pérez ',
  descripcion: ' Certificó el estado de cuenta del predio. ',
}

test('exige área, persona y en qué apoyó', () => {
  assert.equal(getResponseSupportError(valid), null)
  assert.match(getResponseSupportError({ ...valid, dependencia: '' })!, /área/)
  assert.match(getResponseSupportError({ ...valid, dependencia: 'otra' })!, /área/)
  assert.match(getResponseSupportError({ ...valid, persona: ' A ' })!, /nombre/)
  assert.match(getResponseSupportError({ ...valid, descripcion: 'ok' })!, /en qué apoyó/)
  assert.match(getResponseSupportError({ ...valid, descripcion: 'x'.repeat(501) })!, /500/)
})

test('el historial dice quién, de qué área y en qué', () => {
  assert.equal(
    describeResponseSupport(valid),
    'Ana Pérez (Tesorería): Certificó el estado de cuenta del predio.',
  )
})
