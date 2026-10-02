import assert from 'node:assert/strict'
import test from 'node:test'
import { getFilingCorrectionError, planFilingCorrection } from './record-corrections'

const correction = { previousNumber: 'S-100', number: ' S-101 ', date: '2026-09-30' }

test('valida número, fecha y que haya cambios', () => {
  assert.equal(getFilingCorrectionError(correction, '2026-09-29', '2026-10-02'), null)
  assert.match(
    getFilingCorrectionError({ ...correction, number: ' ' }, '', '2026-10-02')!,
    /número/,
  )
  assert.match(getFilingCorrectionError({ ...correction, date: '' }, '', '2026-10-02')!, /fecha/)
  assert.match(
    getFilingCorrectionError({ ...correction, date: '2026-10-03' }, '', '2026-10-02')!,
    /futura/,
  )
  assert.match(
    getFilingCorrectionError({ ...correction, number: 'S-100' }, '2026-09-30', '2026-10-02')!,
    /No hay cambios/,
  )
})

test('actualiza el radicado de la actuación, los documentos y las ampliaciones', () => {
  const changes = planFilingCorrection(
    {
      numeroRadicadoActuacion: 'S-100',
      documentosWorkflow: [
        { id: 'a', radicadoNumero: 'S-100' },
        { id: 'b', radicadoNumero: 'S-200' },
        { id: 'c' },
      ],
      ampliacionesPlazo: [{ numeroRadicado: 'S-100', fechaRadicado: '2026-09-29', dias: 5 }],
    },
    correction,
    (date) => `fecha:${date}`,
  )
  assert.deepEqual(changes, {
    numeroRadicadoActuacion: 'S-101',
    fechaRadicadoActuacion: '2026-09-30',
    documentosWorkflow: [
      { id: 'a', radicadoNumero: 'S-101', radicadoFecha: 'fecha:2026-09-30' },
      { id: 'b', radicadoNumero: 'S-200' },
      { id: 'c' },
    ],
    ampliacionesPlazo: [{ numeroRadicado: 'S-101', fechaRadicado: '2026-09-30', dias: 5 }],
  })
})

test('no toca el expediente si el radicado no aparece en él', () => {
  assert.deepEqual(
    planFilingCorrection(
      { numeroRadicadoActuacion: 'S-300', documentosWorkflow: [{ radicadoNumero: 'S-300' }] },
      correction,
      (date) => date,
    ),
    {},
  )
})
