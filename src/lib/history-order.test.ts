import assert from 'node:assert/strict'
import test from 'node:test'
import { sortHistoryNewestFirst } from './history-order'

const at = (millis: number) => ({ toMillis: () => millis })

test('ordena del más reciente al más antiguo y respeta la secuencia de un mismo guardado', () => {
  const entries = [
    { accion: 'Finalizó expediente', fecha: at(200), orden: 2 },
    { accion: 'Creación', fecha: at(100) },
    { accion: 'Registró radicado de salida', fecha: at(200), orden: 1 },
    { accion: 'Registro tardío', fecha: at(200) },
  ]
  assert.deepEqual(
    sortHistoryNewestFirst(entries).map((entry) => entry.accion),
    ['Finalizó expediente', 'Registró radicado de salida', 'Registro tardío', 'Creación'],
  )
})

test('lo que aún no tiene hora del servidor va primero, sin alterar la lista original', () => {
  const entries = [
    { accion: 'Antigua', fecha: at(100) },
    { accion: 'Guardando', fecha: null },
  ]
  assert.deepEqual(
    sortHistoryNewestFirst(entries).map((entry) => entry.accion),
    ['Guardando', 'Antigua'],
  )
  assert.equal(entries[0].accion, 'Antigua')
})
