import assert from 'node:assert/strict'
import test from 'node:test'
import { canManageExpedient, isSupervisor } from './permissions'

const admin = { uid: 'a', rol: 'Administrador' } as const
const coordinator = { uid: 'c', rol: 'Coordinador' } as const
const official = { uid: 'f', rol: 'Funcionario' } as const
const viewer = { uid: 'v', rol: 'Consulta' } as const
const assignedTo = (uid: string) => ({ uid, nombreCompleto: uid })

test('supervisores gestionan cualquier expediente activo', () => {
  assert.equal(isSupervisor(admin), true)
  assert.equal(isSupervisor(coordinator), true)
  assert.equal(canManageExpedient(coordinator, { activo: true, funcionarioAsignado: assignedTo('x') }), true)
})

test('un funcionario solo gestiona expedientes propios o sin asignar', () => {
  assert.equal(canManageExpedient(official, { activo: true }), true)
  assert.equal(canManageExpedient(official, { activo: true, funcionarioAsignado: assignedTo('f') }), true)
  assert.equal(canManageExpedient(official, { activo: true, funcionarioAsignado: assignedTo('x') }), false)
})

test('consulta y sesiones sin perfil no gestionan expedientes', () => {
  assert.equal(canManageExpedient(viewer, { activo: true }), false)
  assert.equal(canManageExpedient(null, { activo: true }), false)
})

test('los expedientes finalizados solo los modifica el administrador', () => {
  assert.equal(canManageExpedient(admin, { activo: false }), true)
  assert.equal(canManageExpedient(coordinator, { activo: false }), false)
  assert.equal(canManageExpedient(official, { activo: false, funcionarioAsignado: assignedTo('f') }), false)
})
