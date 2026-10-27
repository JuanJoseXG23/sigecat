import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLateTimeline,
  EMPTY_LATE_REGISTRATION,
  evaluateTimeliness,
  getLateRegistrationIssue,
  getLateRegistrationScope,
  planLateRegistration,
  type LateFilingInput,
  type LateRegistrationContext,
  type LateRegistrationInput,
} from './late-registration'

const ana = { uid: 'f1', nombreCompleto: 'Ana Pérez' }
const luis = { uid: 'f2', nombreCompleto: 'Luis Gómez' }
const link = 'https://girardota.sharepoint.com/doc.pdf'

// Entrada el 1 de septiembre de 2026 con 15 días hábiles: vence el martes 22 de septiembre.
const context: LateRegistrationContext = {
  status: 'En respuesta',
  entryNumber: '20261000100',
  entryDate: '2026-09-01',
  currentDeadline: new Date(2026, 8, 22),
  responseDays: 15,
  previousExtensionDays: 0,
  currentAssignee: ana,
  existingDocuments: {},
  today: new Date(2026, 9, 13),
}

const filing = (values: Partial<LateFilingInput> = {}): LateFilingInput => ({
  number: '20262000200',
  date: '2026-09-21',
  sentDate: '2026-09-22',
  documentName: 'Respuesta',
  documentUrl: link,
  folios: '2',
  ...values,
})

const input = (values: Partial<LateRegistrationInput> = {}): LateRegistrationInput => ({
  ...EMPTY_LATE_REGISTRATION,
  reason: 'Alto flujo en la oficina la semana pasada.',
  response: filing(),
  ...values,
})

const extension = {
  filingNumber: '20262000150',
  filingDate: '2026-09-18',
  requestedDays: 10,
  reason: 'Se requiere visita técnica.',
  documentName: 'Oficio de ampliación',
  documentUrl: link,
}

test('el alcance depende del paso en que quedó el expediente', () => {
  assert.deepEqual(getLateRegistrationScope('Recibido')?.outcomes, [
    'response',
    'transfer',
    'pending',
  ])
  assert.equal(getLateRegistrationScope('Recibido')?.receipt, true)
  assert.equal(getLateRegistrationScope('Asignado')?.assignee, true)
  assert.equal(getLateRegistrationScope('En respuesta')?.assignee, false)
  assert.deepEqual(getLateRegistrationScope('Generar radicado de traslado')?.outcomes, [
    'transfer',
    'pending',
  ])
  assert.equal(getLateRegistrationScope('Radicar respuesta')?.citizenResponseOnly, true)
  assert.equal(getLateRegistrationScope('Archivo (Finalizado)'), null)
  assert.equal(getLateRegistrationScope('Archivado'), null)
})

test('una respuesta a tiempo registrada tarde cierra dentro del término', () => {
  const plan = planLateRegistration(input(), context)
  assert.equal(plan.finalStatus, 'Archivo (Finalizado)')
  assert.equal(plan.closingDate, '2026-09-21')
  assert.deepEqual(plan.timeliness, { onTime: true, businessDaysLate: 0 })
  assert.deepEqual(plan.fields, {
    numeroRadicadoActuacion: '20262000200',
    fechaRadicadoActuacion: '2026-09-21',
    fechaEnvioActuacion: '2026-09-22',
  })
  assert.equal(plan.filings[0].fechaEnvio, '2026-09-22')
  assert.equal(plan.documents[0].tipo, 'RADICADO_SALIDA')
  assert.equal(plan.history[0].action, 'Registro tardío de actuaciones')
  assert.equal(plan.history.at(-1)?.action, 'Finalizó expediente')
})

test('una respuesta fuera del término se registra con sus días de retraso', () => {
  const plan = planLateRegistration(
    input({ response: filing({ date: '2026-09-24', sentDate: '2026-09-24' }) }),
    context,
  )
  assert.deepEqual(plan.timeliness, { onTime: false, businessDaysLate: 2 })
  assert.match(plan.history.at(-1)!.detail, /2 días hábiles después/)
})

test('caso de ampliación: vencido en la aplicación, ampliado a tiempo y respondido', () => {
  const plan = planLateRegistration(
    input({
      extensionEnabled: true,
      extension,
      response: filing({ date: '2026-09-30', sentDate: '2026-10-01' }),
    }),
    context,
  )
  // 22 de septiembre + 10 días hábiles = 6 de octubre.
  assert.equal(plan.extension?.newDeadline.toDateString(), new Date(2026, 9, 6).toDateString())
  assert.equal(plan.extension?.totalExtensionDays, 10)
  assert.deepEqual(plan.timeliness, { onTime: true, businessDaysLate: 0 })
  assert.deepEqual(
    plan.filings.map((item) => item.tipo),
    ['Ampliación de plazo', 'Salida'],
  )
  assert.deepEqual(
    plan.history.map((item) => item.action),
    [
      'Registro tardío de actuaciones',
      'Amplió el plazo de respuesta',
      'Registró radicado de salida',
      'Finalizó expediente',
    ],
  )
})

test('una ampliación radicada después del vencimiento no procede', () => {
  const issue = getLateRegistrationIssue(
    input({ extensionEnabled: true, extension: { ...extension, filingDate: '2026-09-23' } }),
    context,
  )
  assert.equal(issue?.section, 'extension')
  assert.match(issue!.message, /después del vencimiento/)
})

test('la ampliación respeta el doble del término inicial', () => {
  const issue = getLateRegistrationIssue(
    input({ extensionEnabled: true, extension: { ...extension, requestedDays: 31 } }),
    context,
  )
  assert.match(issue!.message, /como máximo 30/)
})

test('la ampliación sola deja el expediente activo con la nueva fecha límite', () => {
  const plan = planLateRegistration(
    input({ outcome: 'pending', extensionEnabled: true, extension }),
    context,
  )
  assert.equal(plan.finalStatus, 'En respuesta')
  assert.equal(plan.finalized, false)
  assert.equal(plan.filings.length, 1)
})

test('sin nada que registrar, el trámite en curso se rechaza', () => {
  assert.equal(
    getLateRegistrationIssue(input({ outcome: 'pending' }), context)?.section,
    'situation',
  )
})

test('caso de compañero: quien respondió queda como responsable', () => {
  const plan = planLateRegistration(input({ respondedBy: luis }), context)
  assert.deepEqual(plan.assignee, luis)
  assert.equal(plan.history[1].action, 'Cambio de responsable')
  assert.match(plan.history[1].detail, /Ana Pérez → Luis Gómez/)
  assert.equal(planLateRegistration(input({ respondedBy: ana }), context).assignee, undefined)
})

test('desde Recibido se confirma la recepción, se asigna y se responde', () => {
  const recibido = { ...context, status: 'Recibido' as const, currentAssignee: undefined }
  const values = input({
    receipt: { signed: true, documentName: 'Petición', documentUrl: link, folios: '' },
    assignee: ana,
  })
  assert.equal(
    getLateRegistrationIssue({ ...values, receipt: { ...values.receipt, signed: false } }, recibido)
      ?.section,
    'start',
  )
  assert.match(
    getLateRegistrationIssue({ ...values, assignee: undefined }, recibido)!.message,
    /responsable/,
  )
  const plan = planLateRegistration(values, recibido)
  assert.equal(plan.fields.formatoFisicoFirmado, true)
  assert.deepEqual(plan.assignee, ana)
  assert.deepEqual(
    plan.documents.map((item) => item.tipo),
    ['RECIBIDO', 'RADICADO_SALIDA'],
  )
  assert.equal(plan.finalStatus, 'Archivo (Finalizado)')
})

test('el documento recibido ya asociado no se pide de nuevo', () => {
  const recibido = {
    ...context,
    status: 'Recibido' as const,
    existingDocuments: { RECIBIDO: { nombre: 'Petición', url: link } },
  }
  const values = input({
    receipt: { ...EMPTY_LATE_REGISTRATION.receipt, signed: true },
    assignee: ana,
  })
  assert.equal(getLateRegistrationIssue(values, recibido), null)
  assert.deepEqual(
    planLateRegistration(values, recibido).documents.map((item) => item.tipo),
    ['RADICADO_SALIDA'],
  )
})

test('el escaneo de la respuesta ya asociado sirve de soporte', () => {
  const salida = {
    ...context,
    status: 'Radicado de salida' as const,
    existingDocuments: { RADICADO_SALIDA: { nombre: 'Respuesta', url: link } },
  }
  const values = input({ response: filing({ documentName: '', documentUrl: '', folios: '' }) })
  const plan = planLateRegistration(values, salida)
  assert.equal(plan.documents.length, 0)
  assert.deepEqual(plan.filings[0].documento, { nombre: 'Respuesta', url: link })
  assert.match(getLateRegistrationIssue(values, context)!.message, /Escaneo/)
})

test('traslado por competencia con y sin respuesta al ciudadano', () => {
  const transfer = {
    destination: 'Secretaría de Planeación',
    reason: 'Asunto de su competencia',
    filing: filing({ number: '20262000010', date: '2026-09-04', sentDate: '2026-09-04' }),
  }
  const pendingCitizen = planLateRegistration(
    input({ outcome: 'transfer', transfer, citizenResponseSent: false }),
    context,
  )
  assert.equal(pendingCitizen.finalStatus, 'Generar respuesta al ciudadano')
  assert.equal(pendingCitizen.fields.trasladoPorCompetencia, true)
  assert.equal(pendingCitizen.fields.responsableExterno, 'Secretaría de Planeación')
  assert.deepEqual(pendingCitizen.transferTimeliness, { onTime: true, businessDaysLate: 0 })

  const complete = planLateRegistration(input({ outcome: 'transfer', transfer }), context)
  assert.equal(complete.finalStatus, 'Archivo (Finalizado)')
  assert.deepEqual(
    complete.filings.map((item) => item.tipo),
    ['Traslado', 'Salida'],
  )
  assert.equal(
    complete.history.find((item) => item.action.startsWith('Radicó'))?.action,
    'Radicó respuesta al ciudadano',
  )

  assert.match(
    getLateRegistrationIssue(
      input({
        outcome: 'transfer',
        transfer,
        response: filing({ date: '2026-09-03', sentDate: '2026-09-03' }),
      }),
      context,
    )!.message,
    /anterior al traslado/,
  )
})

test('el traslado tardío frente al art. 21 se advierte sin bloquear', () => {
  const plan = planLateRegistration(
    input({
      outcome: 'transfer',
      citizenResponseSent: false,
      transfer: {
        destination: 'Planeación',
        reason: 'Competencia',
        filing: filing({ number: '20262000010', date: '2026-09-10', sentDate: '2026-09-10' }),
      },
    }),
    context,
  )
  assert.deepEqual(plan.transferTimeliness, { onTime: false, businessDaysLate: 2 })
})

test('valida fechas y números de los radicados', () => {
  const message = (values: Partial<LateFilingInput>) =>
    getLateRegistrationIssue(input({ response: filing(values) }), context)?.message
  assert.match(message({ date: '2026-08-31' })!, /anterior a la radicación/)
  assert.match(message({ date: '2026-10-14', sentDate: '2026-10-14' })!, /futura/)
  assert.match(message({ sentDate: '' })!, /se envió/)
  assert.match(message({ sentDate: '2026-09-20' })!, /anterior a su radicado/)
  assert.match(message({ number: '20261000100' })!, /radicado de entrada/)
  assert.match(
    getLateRegistrationIssue(
      input({ extensionEnabled: true, extension: { ...extension, filingNumber: '20262000200' } }),
      context,
    )!.message,
    /número distinto/,
  )
  assert.match(
    getLateRegistrationIssue(
      input({
        extensionEnabled: true,
        extension,
        response: filing({ date: '2026-09-17', sentDate: '2026-09-17' }),
      }),
      context,
    )!.message,
    /anteriores a la ampliación/,
  )
  assert.match(getLateRegistrationIssue(input({ reason: ' ' }), context)!.message, /por qué/)
})

test('la línea de tiempo muestra el estado de cada actuación frente al vencimiento', () => {
  const events = buildLateTimeline(
    input({
      extensionEnabled: true,
      extension,
      response: filing({ date: '2026-09-30', sentDate: '2026-10-01' }),
    }),
    context,
  )
  assert.deepEqual(
    events.map((event) => [event.date, event.label, event.tone]),
    [
      ['2026-09-01', 'Radicado de entrada', 'neutral'],
      ['2026-09-18', 'Ampliación de plazo', 'success'],
      ['2026-09-22', 'Vencía', 'neutral'],
      ['2026-09-30', 'Respuesta radicada', 'success'],
      ['2026-10-01', 'Respuesta enviada', 'neutral'],
      ['2026-10-06', 'Nueva fecha límite', 'neutral'],
    ],
  )
})

test('evalúa la oportunidad en días hábiles', () => {
  assert.deepEqual(evaluateTimeliness('2026-09-22', new Date(2026, 8, 22)), {
    onTime: true,
    businessDaysLate: 0,
  })
  // Del martes 22 al lunes 28 hay 4 días hábiles.
  assert.deepEqual(evaluateTimeliness('2026-09-28', new Date(2026, 8, 22)), {
    onTime: false,
    businessDaysLate: 4,
  })
})

test('en un expediente interno el registro tardío acepta el radicado interno', () => {
  const internal = input({ response: filing({ number: '2026-000200' }) })
  assert.equal(
    getLateRegistrationIssue(internal, { ...context, correspondenceClass: 'Interna' }),
    null,
  )
  assert.match(
    getLateRegistrationIssue(internal, context)!.message,
    /externa: lo que se envía usa la serie 200/,
  )
})
