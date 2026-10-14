import assert from 'node:assert/strict'
import test from 'node:test'
import { getDeadlineTone, getGridRange, getMonthGrid, groupByDay, isDeadlineOf } from './calendar'
import { getReminderError } from './reminders'

const at = (date: Date) => ({ toDate: () => new Date(date), toMillis: () => date.getTime() })

test('el mes se muestra en 6 semanas de lunes a domingo', () => {
  // Octubre de 2026 empieza en jueves: el cuadro arranca el lunes 28 de septiembre.
  const grid = getMonthGrid(2026, 9)
  assert.equal(grid.length, 42)
  assert.equal(grid[0], '2026-09-28')
  assert.equal(grid[3], '2026-10-01')
  assert.equal(grid[41], '2026-11-08')
  const range = getGridRange(2026, 9)
  assert.equal(range.start.getDate(), 28)
  assert.equal(range.end.getMonth(), 10)
  assert.equal(range.end.getDate(), 9)
  // Un mes que empieza en lunes no repite la semana anterior.
  assert.equal(getMonthGrid(2026, 5)[0], '2026-06-01')
})

const base = {
  estado: 'En respuesta' as const,
  activo: true,
  fechaLimite: at(new Date(2026, 9, 22)),
  fechaActualizacion: at(new Date(2026, 9, 1)),
}

test('pinta el semáforo en trámite y distingue lo respondido a tiempo o tarde', () => {
  assert.equal(getDeadlineTone({ ...base, estadoTermino: 'Vencido' } as never), 'vencido')
  assert.equal(getDeadlineTone({ ...base, estadoTermino: 'Próximo a vencer' } as never), 'proximo')
  assert.equal(getDeadlineTone({ ...base, estadoTermino: 'En plazo' } as never), 'en-plazo')
  const closed = { ...base, estado: 'Archivo (Finalizado)' as const, activo: false }
  assert.equal(
    getDeadlineTone({ ...closed, fechaRadicadoActuacion: '2026-10-20' } as never),
    'respondido',
  )
  assert.equal(
    getDeadlineTone({ ...closed, fechaRadicadoActuacion: '2026-10-23' } as never),
    'respondido-tarde',
  )
})

test('cuenta como vencimiento de una persona lo que tiene o respondió, no lo archivado', () => {
  const mine = { ...base, funcionarioAsignado: { uid: 'ana', nombreCompleto: 'Ana' } }
  assert.equal(isDeadlineOf(mine as never, 'ana'), true)
  assert.equal(isDeadlineOf(mine as never, 'luis'), false)
  assert.equal(
    isDeadlineOf({ ...mine, activo: false, estado: 'Archivo (Finalizado)' } as never, 'ana'),
    true,
  )
  assert.equal(isDeadlineOf({ ...mine, activo: false, estado: 'Archivado' } as never, 'ana'), false)
  assert.equal(isDeadlineOf({ ...mine, fechaLimite: undefined } as never, 'ana'), false)
})

test('agrupa por día', () => {
  const days = groupByDay(['2026-10-01', '2026-10-02', '2026-10-01'], (value) => value)
  assert.deepEqual(days.get('2026-10-01'), ['2026-10-01', '2026-10-01'])
})

const reminder = {
  titulo: 'Reunión de seguimiento',
  descripcion: '',
  fecha: '2026-10-20',
  destinatarios: ['ana'],
  documentos: [],
}

test('un recordatorio exige título, día no pasado, personas y enlaces institucionales', () => {
  const today = '2026-10-14'
  assert.equal(getReminderError(reminder, today), null)
  assert.equal(getReminderError({ ...reminder, fecha: today }, today), null)
  assert.match(getReminderError({ ...reminder, titulo: ' a ' }, today)!, /al menos/)
  assert.match(getReminderError({ ...reminder, fecha: '2026-10-13' }, today)!, /anterior/)
  assert.match(getReminderError({ ...reminder, fecha: '' }, today)!, /Elige el día/)
  assert.match(getReminderError({ ...reminder, destinatarios: [] }, today)!, /persona/)
  assert.match(
    getReminderError(
      { ...reminder, documentos: [{ nombre: 'Acta', url: 'https://example.com/a.pdf' }] },
      today,
    )!,
    /OneDrive/,
  )
  assert.equal(
    getReminderError(
      {
        ...reminder,
        documentos: [{ nombre: 'Acta', url: 'https://girardotaa-my.sharepoint.com/:b:/x' }],
      },
      today,
    ),
    null,
  )
})
