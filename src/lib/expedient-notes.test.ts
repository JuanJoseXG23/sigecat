import assert from 'node:assert/strict'
import test from 'node:test'
import { canAddNote, getNoteError, isNote } from './expedient-notes'

test('la nota tiene entre 5 y 1000 caracteres, sin contar espacios de los extremos', () => {
  assert.equal(getNoteError('Se confirmó con la planilla de Archivo.'), null)
  assert.equal(getNoteError('  12345  '), null)
  assert.match(getNoteError('   ok   ')!, /al menos 5/)
  assert.match(getNoteError('')!, /al menos 5/)
  assert.equal(getNoteError('x'.repeat(1000)), null)
  assert.match(getNoteError('x'.repeat(1001))!, /1000/)
})

test('escriben notas los supervisores y el Funcionario que figura en el expediente', () => {
  const expedient = { participantes: ['ana', 'luis'] }
  assert.equal(canAddNote({ uid: 'a', rol: 'Administrador' }, expedient), true)
  assert.equal(canAddNote({ uid: 'c', rol: 'Coordinador' }, expedient), true)
  // Luis lo tuvo antes: ya no lo gestiona, pero sí aclara.
  assert.equal(canAddNote({ uid: 'luis', rol: 'Funcionario' }, expedient), true)
  assert.equal(canAddNote({ uid: 'otro', rol: 'Funcionario' }, expedient), false)
  assert.equal(canAddNote({ uid: 'otro', rol: 'Funcionario' }, {}), false)
  assert.equal(canAddNote({ uid: 'd', rol: 'Directivo' }, expedient), false)
  assert.equal(canAddNote({ uid: 'v', rol: 'Consulta' }, expedient), false)
  assert.equal(canAddNote(null, expedient), false)
})

test('distingue las notas del resto del historial', () => {
  assert.equal(isNote({ accion: 'Nota' }), true)
  assert.equal(isNote({ accion: 'Documento asociado' }), false)
})
