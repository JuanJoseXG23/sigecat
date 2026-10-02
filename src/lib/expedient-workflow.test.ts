import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMPTY_ACTUATION_INPUT,
  getFlow,
  getMissingRequirement,
  planActuation,
  STANDARD_FLOW,
  TRANSFER_FLOW,
  type ActuationInput,
} from './expedient-workflow'
import type { ExpedientStatus } from '@/types/expedient'

const official = { uid: 'f1', nombreCompleto: 'Ana Pérez' }
const filing = { filingNumber: ' S-100 ', filingDate: '2026-10-02' }
const input = (values: Partial<ActuationInput> = {}): ActuationInput => ({
  ...EMPTY_ACTUATION_INPUT,
  ...values,
})
const standard = (estado: ExpedientStatus) => ({ estado, trasladoPorCompetencia: false })
const transfer = (estado: ExpedientStatus) => ({ estado, trasladoPorCompetencia: true })

test('el traslado por competencia cambia al flujo de traslado', () => {
  assert.equal(getFlow({ trasladoPorCompetencia: false }), STANDARD_FLOW)
  assert.equal(getFlow({ trasladoPorCompetencia: true }), TRANSFER_FLOW)
  assert.equal(getFlow({}), STANDARD_FLOW)
})

test('Recibido exige firma y documento recibido, y pasa a Asignado', () => {
  assert.equal(
    getMissingRequirement('Recibido', input({ signed: true }), []),
    'Asocia el documento requerido en OneDrive.',
  )
  assert.equal(
    getMissingRequirement('Recibido', input(), [{ tipo: 'RECIBIDO' }]),
    'Confirma que el formato físico fue firmado.',
  )
  assert.equal(
    getMissingRequirement('Recibido', input({ signed: true }), [{ tipo: 'RECIBIDO' }]),
    null,
  )
  assert.deepEqual(planActuation(standard('Recibido'), input({ signed: true })), {
    kind: 'complete',
    action: 'Confirmó firma del formato físico',
    detail: 'Formato físico firmado.',
    nextStatus: 'Asignado',
    fields: { formatoFisicoFirmado: true },
  })
})

test('Asignado asigna responsable y avanza a En respuesta', () => {
  assert.equal(getMissingRequirement('Asignado', input(), []), 'Selecciona el responsable.')
  assert.deepEqual(planActuation(standard('Asignado'), input({ assignee: official })), {
    kind: 'assign',
    assignee: official,
    advanceTo: 'En respuesta',
  })
})

test('En respuesta ofrece responder, trasladar o reasignar', () => {
  assert.equal(planActuation(standard('En respuesta'), input()).kind, 'complete')
  assert.equal(
    (planActuation(standard('En respuesta'), input()) as { nextStatus: string }).nextStatus,
    'Radicado de salida',
  )
  assert.equal(
    getMissingRequirement(
      'En respuesta',
      input({ choice: 'transfer', destination: 'Planeación' }),
      [],
    ),
    'Indica la dependencia destino y el motivo del traslado.',
  )
  assert.deepEqual(
    planActuation(
      standard('En respuesta'),
      input({ choice: 'transfer', destination: 'Planeación', reason: 'Competencia' }),
    ),
    { kind: 'transfer', destination: 'Planeación', reason: 'Competencia' },
  )
  assert.deepEqual(
    planActuation(standard('En respuesta'), input({ choice: 'change', assignee: official })),
    { kind: 'assign', assignee: official },
  )
  assert.throws(() => planActuation(standard('En respuesta'), input({ choice: 'change' })))
})

test('Radicado de salida exige radicado y finaliza sin tocar el radicado de entrada', () => {
  assert.equal(
    getMissingRequirement('Radicado de salida', input(), [{ tipo: 'RADICADO_SALIDA' }]),
    'Registra el número y la fecha de radicado.',
  )
  assert.deepEqual(planActuation(standard('Radicado de salida'), input(filing)), {
    kind: 'complete',
    action: 'Registró radicado de salida',
    detail: 'Radicado S-100.',
    nextStatus: 'Archivo (Finalizado)',
    fields: { numeroRadicadoActuacion: 'S-100', fechaRadicadoActuacion: '2026-10-02' },
  })
})

test('el flujo de traslado recorre todos sus pasos', () => {
  const step = (status: ExpedientStatus, values: Partial<ActuationInput> = {}) =>
    planActuation(transfer(status), input(values)) as { action: string; nextStatus: string }

  assert.equal(step('Traslado por competencia').nextStatus, 'Generar radicado de traslado')
  assert.equal(step('Generar radicado de traslado', filing).action, 'Registró radicado de traslado')
  assert.equal(
    step('Generar radicado de traslado', filing).nextStatus,
    'Generar respuesta al ciudadano',
  )
  assert.equal(step('Generar respuesta al ciudadano').nextStatus, 'Radicar respuesta')
  assert.equal(step('Radicar respuesta', filing).action, 'Radicó respuesta al ciudadano')
  assert.equal(step('Radicar respuesta', filing).nextStatus, 'Archivo (Finalizado)')
})

test('un expediente finalizado o archivado no tiene actuación pendiente', () => {
  assert.throws(() => planActuation(standard('Archivo (Finalizado)'), input()))
  assert.throws(() => planActuation(standard('Archivado'), input()))
})
