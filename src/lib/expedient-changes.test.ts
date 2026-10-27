import assert from 'node:assert/strict'
import test from 'node:test'
import { describeExpedientChanges, type EditableSnapshot } from './expedient-changes'

const base: EditableSnapshot = {
  area: 'Catastro',
  correspondencia: 'Externa',
  numeroRadicado: 'DP6589',
  fechaRadicado: '2026-09-09',
  tipoTramite: 'Derecho de petición',
  responsable: 'John',
  prioridad: 'Media',
  asunto: 'Avalúo',
  solicitantes: [{ nombre: 'Rafael', documento: '70322250', correo: 'a@b.co' }],
  predios: [{ numeroPredial: '123' }],
}

test('sin cambios no hay nada que contar, aunque cambien espacios o campos vacíos', () => {
  assert.deepEqual(
    describeExpedientChanges(base, {
      ...base,
      asunto: ' Avalúo ',
      solicitantes: [{ nombre: 'Rafael', documento: '70322250', correo: 'a@b.co', telefono: '' }],
    }),
    [],
  )
})

test('cuenta el antes y el después del radicado y sus fechas', () => {
  assert.deepEqual(
    describeExpedientChanges(base, {
      ...base,
      numeroRadicado: '20261006589',
      fechaRadicado: '2026-09-08',
      fechaRecibido: '2026-09-10',
    }),
    [
      'Radicado de entrada: DP6589 → 20261006589',
      'Fecha de radicado: 2026-09-09 → 2026-09-08',
      'Fecha de recibido: Sin dato → 2026-09-10',
    ],
  )
})

test('nombra lo personal o largo sin copiarlo y describe solicitantes y predios', () => {
  assert.deepEqual(
    describeExpedientChanges(base, {
      ...base,
      asunto: 'Otro asunto',
      observaciones: 'Nota',
      solicitantes: [{ nombre: 'Rafael', documento: '70322250', correo: 'nuevo@b.co' }],
      predios: [{ numeroPredial: '456' }],
    }),
    [
      'Asunto actualizado',
      'Datos de contacto del solicitante actualizados',
      'Predios: 123 → 456',
      'Observaciones iniciales actualizadas',
    ],
  )
  assert.deepEqual(describeExpedientChanges(base, { ...base, solicitantes: [{ nombre: 'Ana' }] }), [
    'Solicitantes: Rafael 70322250 → Ana',
  ])
})

test('cuenta el cambio de clase de correspondencia', () => {
  assert.deepEqual(describeExpedientChanges(base, { ...base, correspondencia: 'Interna' }), [
    'Correspondencia: Externa → Interna',
  ])
})
