import assert from 'node:assert/strict'
import test from 'node:test'
import { createExpedientSchema } from './expedient-schema'

const values = (overrides: Record<string, unknown> = {}) => ({
  dependencia: 'catastro',
  clase: 'Externa',
  numeroRadicado: '20261000123',
  fechaRadicado: '2026-10-01',
  tipoTramiteId: 't1',
  solicitantes: [{ nombre: 'Rafael' }],
  predios: [],
  ...overrides,
})

const issues = (result: ReturnType<ReturnType<typeof createExpedientSchema>['safeParse']>) =>
  result.success ? [] : result.error.issues.map((issue) => [issue.path.join('.'), issue.message])

test('registra correspondencia interna con su radicado y remitente', () => {
  const result = createExpedientSchema().safeParse(
    values({ clase: 'Interna', numeroRadicado: '2026-000123' }),
  )
  assert.deepEqual(issues(result), [])
})

test('la correspondencia interna exige el remitente', () => {
  const result = createExpedientSchema().safeParse(
    values({ clase: 'Interna', numeroRadicado: '2026-000123', solicitantes: [{ nombre: ' ' }] }),
  )
  assert.deepEqual(issues(result), [
    ['solicitantes.0.nombre', 'Escribe la dependencia o funcionario remitente.'],
  ])
})

test('un expediente antiguo se edita sin revalidar su radicado ni su clase', () => {
  const previous = { numeroRadicado: 'DP6480', clase: 'Externa' } as const
  const result = createExpedientSchema(previous).safeParse(values({ numeroRadicado: 'DP6480' }))
  assert.deepEqual(issues(result), [])
})

test('cambiar la clase revalida el radicado aunque el número sea el mismo', () => {
  const previous = { numeroRadicado: '20261000123', clase: 'Externa' } as const
  const result = createExpedientSchema(previous).safeParse(values({ clase: 'Interna' }))
  assert.equal(issues(result)[0]?.[0], 'numeroRadicado')
})
