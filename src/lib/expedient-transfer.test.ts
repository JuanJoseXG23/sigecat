import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMPTY_TRANSFER_INPUT,
  getTransferError,
  OTHER_DESTINATION,
  planTransfer,
  type TransferContext,
  type TransferInput,
} from './expedient-transfer'
import { formatDate } from './format'

const context: TransferContext = {
  dependency: 'catastro',
  entryDate: '2026-10-01',
  correspondenceClass: 'Externa',
  today: new Date(2026, 9, 27),
}

const input = (values: Partial<TransferInput> = {}): TransferInput => ({
  ...EMPTY_TRANSFER_INPUT,
  destination: 'tesoreria',
  reason: ' No es competencia de Catastro. ',
  date: '2026-10-27',
  ...values,
})

const link = 'https://girardota.sharepoint.com/oficio.pdf'

test('exige un destino distinto del área del expediente', () => {
  assert.match(getTransferError(input({ destination: '' }), context)!, /destino/)
  assert.match(getTransferError(input({ destination: 'catastro' }), context)!, /misma área/)
  assert.match(
    getTransferError(input({ destination: OTHER_DESTINATION, otherDestination: 'ab' }), context)!,
    /3/,
  )
  assert.equal(getTransferError(input(), context), null)
})

test('exige motivo y una fecha entre la radicación y hoy', () => {
  assert.match(getTransferError(input({ reason: 'abcd' }), context)!, /motivo/)
  assert.match(getTransferError(input({ date: '' }), context)!, /fecha/)
  assert.match(getTransferError(input({ date: '2026-10-28' }), context)!, /futura/)
  assert.match(getTransferError(input({ date: '2026-09-30' }), context)!, /anterior/)
})

test('el radicado del oficio es opcional, pero completo y con el formato de la clase', () => {
  assert.match(getTransferError(input({ filingNumber: '20262000456' }), context)!, /fecha/)
  const internal = { filingNumber: '2026-000456', filingDate: '2026-10-27' }
  assert.match(getTransferError(input(internal), context)!, /Interna/)
  assert.equal(
    getTransferError(input(internal), { ...context, correspondenceClass: 'Interna' }),
    null,
  )
})

test('el documento del oficio es opcional, pero con enlace institucional', () => {
  assert.match(
    getTransferError(
      input({ documentName: 'Oficio', documentUrl: 'https://drive.google.com/x' }),
      context,
    )!,
    /OneDrive/,
  )
})

test('transferir a un área de SIGECAT deja la traza sin documento ni radicado', () => {
  const plan = planTransfer(input(), context)
  assert.deepEqual(plan.transfer, {
    destino: 'Tesorería',
    dependenciaDestino: 'tesoreria',
    motivo: 'No es competencia de Catastro.',
    fecha: '2026-10-27',
  })
  assert.equal(plan.document, undefined)
  assert.equal(plan.filing, undefined)
  assert.equal(
    plan.historyDetail,
    `A Tesorería el ${formatDate('2026-10-27')}. Motivo: No es competencia de Catastro.`,
  )
})

test('transferir a otra dependencia con oficio radicado guarda documento y radicado', () => {
  const plan = planTransfer(
    input({
      destination: OTHER_DESTINATION,
      otherDestination: ' Secretaría de Gobierno ',
      filingNumber: ' 20262000456 ',
      filingDate: '2026-10-27',
      documentName: 'Oficio de transferencia',
      documentUrl: link,
      folios: '2',
    }),
    context,
  )
  assert.equal(plan.transfer.destino, 'Secretaría de Gobierno')
  assert.equal(plan.transfer.dependenciaDestino, undefined)
  assert.equal(plan.transfer.numeroRadicado, '20262000456')
  assert.deepEqual(plan.filing, { numero: '20262000456', fecha: '2026-10-27' })
  assert.deepEqual(plan.document, {
    nombre: 'Oficio de transferencia',
    url: link,
    folios: 2,
    radicadoNumero: '20262000456',
    radicadoFecha: '2026-10-27',
  })
  assert.ok(plan.historyDetail.endsWith('Radicado 20262000456.'))
})

test('planTransfer rechaza lo que getTransferError no acepta', () => {
  assert.throws(() => planTransfer(input({ reason: '' }), context), /motivo/)
})
