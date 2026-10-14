import assert from 'node:assert/strict'
import test from 'node:test'
import { getDependencyName, getExpedientDependency, toDependencyId } from './dependencies'

test('reconoce ids y nombres escritos a mano, sin importar tildes ni mayúsculas', () => {
  assert.equal(toDependencyId('catastro'), 'catastro')
  assert.equal(toDependencyId(' Catastro '), 'catastro')
  assert.equal(toDependencyId('Tesoreria'), 'tesoreria')
  assert.equal(toDependencyId('COBRO COACTIVO'), 'cobro-coactivo')
  assert.equal(toDependencyId('fiscalización'), 'fiscalizacion')
  assert.equal(toDependencyId('Secretaría de Hacienda'), undefined)
  assert.equal(toDependencyId(''), undefined)
})

test('muestra el nombre del área o el valor antiguo tal cual', () => {
  assert.equal(getDependencyName('cobro-coactivo'), 'Cobro coactivo')
  assert.equal(getDependencyName('Oficina vieja'), 'Oficina vieja')
  assert.equal(getDependencyName(undefined), 'Sin área')
})

test('los expedientes sin área son de Catastro', () => {
  assert.equal(getExpedientDependency({}), 'catastro')
  assert.equal(getExpedientDependency({ dependencia: 'impuestos' }), 'impuestos')
})
