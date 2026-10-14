import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveParticipants, findNamedPeople } from './participants'

const ana = { uid: 'a', nombreCompleto: 'Ana Pérez' }
const anaMaria = { uid: 'am', nombreCompleto: 'Ana Pérez Gómez' }
const luis = { uid: 'l', nombreCompleto: 'Luis Gómez' }
const people = [ana, anaMaria, luis]

test('encuentra nombres completos como palabras enteras, sin importar tildes', () => {
  assert.deepEqual(findNamedPeople('Sin asignar → Ana Perez', people), ['a'])
  assert.deepEqual(findNamedPeople('Ana Pérez Gómez → Luis Gómez', people), ['am', 'l'])
  assert.deepEqual(findNamedPeople('Luis Gómezz', people), [])
})

test('reúne creador, responsable, quienes actuaron y quienes lo tuvieron asignado', () => {
  const result = deriveParticipants(
    {
      creadoPor: 'c',
      funcionarioAsignado: { uid: 'l' },
      participantes: ['x'],
      history: [
        { usuario: 'c', accion: 'Creación del expediente', detalle: '' },
        { usuario: 'c', accion: 'Cambio de responsable', detalle: 'Sin asignar → Ana Pérez' },
        { usuario: 'sistema', accion: 'Recalculó la fecha límite', detalle: '' },
        {
          usuario: 'l',
          accion: 'Edición del expediente',
          detalle: 'Responsable: Ana Pérez → Luis Gómez',
        },
      ],
    },
    [...people, { uid: 'c', nombreCompleto: 'Carla Ruiz' }],
  )
  assert.deepEqual(result, ['x', 'c', 'l', 'a'])
})

test('no toma nombres de textos libres como los motivos', () => {
  const result = deriveParticipants(
    {
      creadoPor: 'c',
      history: [
        { usuario: 'c', accion: 'Motivo del traslado', detalle: 'Lo pidió Ana Pérez' },
        {
          usuario: 'c',
          accion: 'Registro tardío de actuaciones',
          detalle: 'Ana Pérez estaba de vacaciones',
        },
      ],
    },
    people,
  )
  assert.deepEqual(result, ['c'])
})
