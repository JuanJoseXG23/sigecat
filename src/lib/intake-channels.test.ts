import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeIntakeChannel } from './intake-channels'

test('agrupa sin distinguir mayúsculas, tildes ni espacios', () => {
  assert.equal(normalizeIntakeChannel('CORREO'), 'Correo')
  assert.equal(normalizeIntakeChannel(' correo '), 'Correo')
  assert.equal(normalizeIntakeChannel('PRESENCIAL'), 'Presencial')
  assert.equal(normalizeIntakeChannel('correo  electronico'), 'Correo electrónico')
  assert.equal(normalizeIntakeChannel('VENTANILLA UNICA'), 'Ventanilla única')
  assert.equal(normalizeIntakeChannel(''), undefined)
  assert.equal(normalizeIntakeChannel(undefined), undefined)
})
