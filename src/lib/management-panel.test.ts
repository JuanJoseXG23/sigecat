import assert from 'node:assert/strict'
import test from 'node:test'
import type { Timestamp } from 'firebase/firestore'
import { getInquiryError } from './inquiry'
import {
  countAnsweredThisMonth,
  countByStage,
  countByTraffic,
  getClosedSince,
  getMonthlySeries,
  getRecentlyAnswered,
  getTimeliness,
  getWorkload,
  isAnswered,
} from './management-panel'
import { isFinalizedExpedient } from '@/types/expedient'
import type { Expedient } from '@/types/expedient'

const at = (year: number, month: number, day: number) =>
  ({
    toDate: () => new Date(year, month - 1, day),
    toMillis: () => new Date(year, month - 1, day).getTime(),
  }) as Timestamp

const ana = { uid: 'f1', nombreCompleto: 'Ana Pérez' }
const luis = { uid: 'f2', nombreCompleto: 'Luis Gómez' }

const item = (values: Partial<Expedient>): Expedient =>
  ({
    id: 'x',
    numeroRadicado: 'E-1',
    fechaRadicado: at(2026, 9, 1),
    solicitantes: [],
    predios: [],
    estado: 'En respuesta',
    activo: true,
    fechaCreacion: at(2026, 9, 1),
    fechaActualizacion: at(2026, 9, 1),
    creadoPor: 'u',
    ...values,
  }) as Expedient

const answered = (response: string, deadline: Timestamp, values: Partial<Expedient> = {}) =>
  item({
    estado: 'Archivo (Finalizado)',
    activo: false,
    fechaLimite: deadline,
    fechaRadicadoActuacion: response,
    // Cerrado en la aplicación días después: no debe contar como fecha de respuesta.
    fechaCierre: at(2026, 10, 13),
    ...values,
  })

test('cuenta los activos por semáforo y por paso, en el orden del flujo', () => {
  const items = [
    item({ estadoTermino: 'Vencido', estado: 'Radicado de salida' }),
    item({ estadoTermino: 'Vencido', estado: 'Recibido' }),
    item({ estadoTermino: 'En plazo', estado: 'Recibido' }),
    item({ estadoTermino: 'Próximo a vencer' }),
  ]
  assert.deepEqual(countByTraffic(items), { 'En plazo': 1, 'Próximo a vencer': 1, Vencido: 2 })
  assert.deepEqual(countByStage(items), [
    ['Recibido', 2],
    ['En respuesta', 1],
    ['Radicado de salida', 1],
  ])
})

test('ordena la carga por responsable con los vencidos primero', () => {
  const workload = getWorkload([
    item({ funcionarioAsignado: ana, estadoTermino: 'En plazo' }),
    item({ funcionarioAsignado: ana, estadoTermino: 'En plazo' }),
    item({ funcionarioAsignado: luis, estadoTermino: 'Vencido' }),
    item({ estadoTermino: 'Próximo a vencer' }),
  ])
  assert.deepEqual(
    workload.map((entry) => [entry.name, entry.total, entry.traffic.Vencido]),
    [
      ['Luis Gómez', 1, 1],
      ['Sin responsable', 1, 0],
      ['Ana Pérez', 2, 0],
    ],
  )
})

test('la oportunidad usa la fecha de la respuesta, no la del cierre en la aplicación', () => {
  const items = [
    answered('2026-09-20', at(2026, 9, 22)),
    answered('2026-09-25', at(2026, 9, 22)),
    item({ estado: 'Archivado', activo: false, fechaLimite: at(2026, 9, 22) }),
    item({ estadoTermino: 'Vencido' }),
  ]
  assert.deepEqual(getTimeliness(items), { onTime: 1, late: 1, rate: 50 })
  assert.deepEqual(getTimeliness([item({})]), { onTime: 0, late: 0, rate: null })
})

test('arma la serie mensual de radicados y respondidos', () => {
  const series = getMonthlySeries(
    [
      item({ fechaRadicado: at(2026, 8, 3) }),
      answered('2026-09-20', at(2026, 9, 22), { fechaRadicado: at(2026, 9, 1) }),
      answered('2026-10-02', at(2026, 9, 22), { fechaRadicado: at(2026, 9, 2) }),
      item({ fechaRadicado: at(2025, 1, 1) }),
    ],
    3,
    new Date(2026, 9, 13),
  )
  assert.deepEqual(series, [
    { month: '2026-08', received: 1, answered: 0, answeredOnTime: 0 },
    { month: '2026-09', received: 2, answered: 1, answeredOnTime: 1 },
    { month: '2026-10', received: 0, answered: 1, answeredOnTime: 0 },
  ])
})

test('cuenta los respondidos del mes y lista los más recientes', () => {
  const first = answered('2026-10-02', at(2026, 10, 5), { id: 'a' })
  const second = answered('2026-10-08', at(2026, 10, 5), { id: 'b' })
  const old = answered('2026-09-20', at(2026, 9, 22), { id: 'c' })
  assert.equal(countAnsweredThisMonth([first, second, old], new Date(2026, 9, 13)), 2)
  assert.deepEqual(
    getRecentlyAnswered([first, old, second], 2).map((entry) => entry.id),
    ['b', 'a'],
  )
})

test('pide los cerrados desde lo que empiece antes: el año o los meses de la gráfica', () => {
  assert.deepEqual(getClosedSince(new Date(2026, 9, 13)), new Date(2026, 0, 1))
  assert.deepEqual(getClosedSince(new Date(2026, 1, 10)), new Date(2025, 8, 1))
  assert.deepEqual(getClosedSince(new Date(2026, 5, 30)), new Date(2026, 0, 1))
})

test('la pregunta exige responsable y un texto razonable', () => {
  assert.match(getInquiryError('¿Cómo va?', undefined)!, /no tiene responsable/)
  assert.equal(getInquiryError('  ', ana), 'Escribe la pregunta.')
  assert.match(getInquiryError('a'.repeat(1001), ana)!, /1000/)
  assert.equal(getInquiryError('¿En qué va este trámite?', ana), null)
})

test('un transferido está cerrado pero no cuenta como respondido', () => {
  assert.equal(isAnswered({ estado: 'Transferido', activo: false }), false)
  assert.equal(isFinalizedExpedient({ estado: 'Transferido', activo: true }), true)
})
