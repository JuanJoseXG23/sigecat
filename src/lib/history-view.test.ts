import assert from 'node:assert/strict'
import test from 'node:test'
import {
  categorizeHistoryAction,
  groupHistoryByDay,
  matchesHistorySearch,
  splitHistoryChanges,
} from './history-view'

test('cada acción del historial cae en su categoría', () => {
  const expected: Record<string, string> = {
    Nota: 'notas',
    'Corrigió radicado de entrada': 'correcciones',
    'Corrigió radicado': 'correcciones',
    'Corrigió fecha de cierre': 'correcciones',
    'Edición del expediente': 'correcciones',
    'Actualización del expediente': 'correcciones',
    'Pregunta de la dirección': 'comunicaciones',
    'Correo de asignación enviado': 'comunicaciones',
    'Alerta de vencimiento enviada': 'comunicaciones',
    'Documento asociado': 'documentos',
    'Registró radicado de salida': 'radicados',
    'Radicó respuesta al ciudadano': 'radicados',
    'Amplió el plazo de respuesta': 'radicados',
    'Recalculó la fecha límite': 'radicados',
    'Creación del expediente': 'tramite',
    'Asignó responsable': 'tramite',
    'Traslado por competencia': 'tramite',
    'Finalizó expediente': 'tramite',
    'Registro tardío de actuaciones': 'tramite',
    'Acción desconocida': 'tramite',
  }
  for (const [action, category] of Object.entries(expected))
    assert.equal(categorizeHistoryAction(action), category, action)
})

const at = (iso: string) => ({ toDate: () => new Date(iso) })

test('busca sin tildes ni mayúsculas en acción, detalle y usuario', () => {
  const entry = { accion: 'Nota', detalle: 'Se confirmó con Archivo', usuario: 'u', fecha: null }
  assert.equal(matchesHistorySearch(entry, 'confirmo', 'Ana'), true)
  assert.equal(matchesHistorySearch(entry, 'ANA', 'Ana'), true)
  assert.equal(matchesHistorySearch(entry, 'traslado', 'Ana'), false)
  assert.equal(matchesHistorySearch(entry, '  ', 'Ana'), true)
})

test('agrupa por día las entradas consecutivas', () => {
  const groups = groupHistoryByDay([
    { id: 'a', fecha: at('2026-10-14T16:00:00') },
    { id: 'b', fecha: at('2026-10-14T09:00:00') },
    { id: 'c', fecha: at('2026-10-13T18:00:00') },
    { id: 'd', fecha: null },
  ])
  assert.deepEqual(
    groups.map((group) => [group.day, group.entries.map((entry) => entry.id)]),
    [
      ['2026-10-14', ['a', 'b']],
      ['2026-10-13', ['c']],
      ['', ['d']],
    ],
  )
})

test('separa los cambios de una edición sin cortar valores con punto', () => {
  assert.deepEqual(
    splitHistoryChanges(
      'Radicado de entrada: DP6589 → 20261006589. Medio de ingreso: Sr. Pérez → Ventanilla única. Asunto actualizado',
    ),
    [
      {
        label: 'Radicado de entrada',
        before: 'DP6589',
        after: '20261006589',
        text: 'Radicado de entrada: DP6589 → 20261006589',
      },
      {
        label: 'Medio de ingreso',
        before: 'Sr. Pérez',
        after: 'Ventanilla única',
        text: 'Medio de ingreso: Sr. Pérez → Ventanilla única',
      },
      { text: 'Asunto actualizado' },
    ],
  )
  assert.deepEqual(splitHistoryChanges('Formato físico firmado.'), [
    { text: 'Formato físico firmado.' },
  ])
})
