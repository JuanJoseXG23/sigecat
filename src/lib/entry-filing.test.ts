import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getOutgoingFilingNumbers,
  hasReplacedEntryFiling,
  suggestEntryFiling,
} from './entry-filing'

const documents = [
  { tipo: 'RECIBIDO', nombre: '20261007115' },
  { tipo: 'TRASLADO', nombre: '20262007893' },
  { tipo: 'RADICADO_SALIDA', nombre: 'Respuesta firmada', radicadoNumero: '20262007894' },
]

test('reúne los radicados de salida, traslado y ampliación', () => {
  const numbers = getOutgoingFilingNumbers({
    numeroRadicadoActuacion: 'S-1',
    ampliacionesPlazo: [{ numeroRadicado: 'S-2' }],
    documentosWorkflow: documents,
  })
  assert.deepEqual([...numbers].sort(), ['20262007893', '20262007894', 'S-1', 'S-2'])
})

test('detecta un radicado de entrada reemplazado y sugiere el del documento recibido', () => {
  const expedient = { numeroRadicado: '20262007894', documentosWorkflow: documents }
  assert.equal(hasReplacedEntryFiling(expedient), true)
  assert.equal(suggestEntryFiling(expedient), '20261007115')
})

test('no marca un expediente con su radicado de entrada', () => {
  assert.equal(
    hasReplacedEntryFiling({ numeroRadicado: '20261007115', documentosWorkflow: documents }),
    false,
  )
})

test('no sugiere nombres de documento que no parecen radicados', () => {
  const expedient = {
    numeroRadicado: 'S-1',
    numeroRadicadoActuacion: 'S-1',
    documentosWorkflow: [{ tipo: 'RECIBIDO', nombre: 'Petición escaneada' }],
  }
  assert.equal(suggestEntryFiling(expedient), undefined)
})
