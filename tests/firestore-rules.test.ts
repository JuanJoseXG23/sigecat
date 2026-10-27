import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

/**
 * Reglas de firestore.rules contra el emulador (proyecto de prueba, nunca el real):
 * npm run test:rules
 */
let env: RulesTestEnvironment

const users = {
  admin: { rol: 'Administrador', dependencia: 'catastro' },
  coordinator: { rol: 'Coordinador', dependencia: 'catastro' },
  director: { rol: 'Directivo' },
  viewer: { rol: 'Consulta' },
  ana: { rol: 'Funcionario', dependencia: 'catastro' },
  luis: { rol: 'Funcionario', dependencia: 'catastro' },
  tesoreria: { rol: 'Funcionario', dependencia: 'tesoreria' },
  inactive: { rol: 'Funcionario', dependencia: 'catastro', activo: false },
} as const

type UserKey = keyof typeof users

const as = (user: UserKey): Firestore => env.authenticatedContext(user).firestore()

/** Expediente activo de Ana (lo registró y lo tiene), en el que Luis participó antes. */
const anaExpedient = {
  id: 'e1',
  numeroRadicado: '20261000001',
  dependencia: 'catastro',
  estado: 'En respuesta',
  activo: true,
  creadoPor: 'ana',
  funcionarioAsignado: { uid: 'ana', nombreCompleto: 'Ana' },
  participantes: ['luis', 'ana'],
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sigecat',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8181 },
  })
})

after(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    for (const [uid, data] of Object.entries(users))
      await setDoc(doc(db, 'usuarios', uid), { activo: true, ...data })
    await setDoc(doc(db, 'expedientes/e1'), anaExpedient)
    await setDoc(doc(db, 'radicadosEntrada/20261000001'), { expedienteId: 'e1' })
    await setDoc(doc(db, 'expedientes/e2'), {
      ...anaExpedient,
      id: 'e2',
      numeroRadicado: '20261000002',
      creadoPor: 'tesoreria',
      dependencia: 'tesoreria',
      funcionarioAsignado: { uid: 'tesoreria', nombreCompleto: 'Teso' },
      participantes: ['tesoreria'],
    })
    await setDoc(doc(db, 'expedientes/e1/historial/h1'), { usuario: 'ana', accion: 'x' })
    await setDoc(doc(db, 'radicados/e1_20262000001'), { expedienteId: 'e1', numero: '20262000001' })
    await setDoc(doc(db, 'radicados/e2_20262000002'), { expedienteId: 'e2', numero: '20262000002' })
  })
})

const mine = (db: Firestore, uid: string) =>
  query(
    collection(db, 'expedientes'),
    where('participantes', 'array-contains', uid),
    where('activo', '==', true),
  )

test('el Funcionario ve solo los expedientes donde participa', async () => {
  await assertSucceeds(getDocs(mine(as('ana'), 'ana')))
  await assertSucceeds(getDoc(doc(as('ana'), 'expedientes/e1')))
  // Luis lo tuvo antes: lo sigue viendo.
  await assertSucceeds(getDoc(doc(as('luis'), 'expedientes/e1')))
  await assertFails(getDoc(doc(as('tesoreria'), 'expedientes/e1')))
  await assertFails(getDocs(collection(as('ana'), 'expedientes')))
  await assertFails(
    getDocs(query(collection(as('ana'), 'expedientes'), where('activo', '==', true))),
  )
})

test('los usuarios mayores y Consulta ven todo; una cuenta inactiva nada', async () => {
  for (const user of ['admin', 'coordinator', 'director', 'viewer'] as const)
    await assertSucceeds(getDocs(collection(as(user), 'expedientes')))
  await assertFails(getDoc(doc(as('inactive'), 'expedientes/e1')))
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'expedientes/e1')))
})

test('historial y radicados se ven como su expediente', async () => {
  await assertSucceeds(getDocs(collection(as('luis'), 'expedientes/e1/historial')))
  await assertFails(getDocs(collection(as('tesoreria'), 'expedientes/e1/historial')))
  const filingsOf = (db: Firestore, ids: string[]) =>
    getDocs(query(collection(db, 'radicados'), where('expedienteId', 'in', ids)))
  await assertSucceeds(filingsOf(as('ana'), ['e1']))
  await assertFails(filingsOf(as('ana'), ['e1', 'e2']))
  await assertFails(getDocs(collection(as('ana'), 'radicados')))
  await assertSucceeds(getDocs(collection(as('director'), 'radicados')))
})

/** Lote de creación como lo arma createExpedient. */
function createBatch(db: Firestore, overrides: Record<string, unknown> = {}, claim = true) {
  const data = {
    id: 'e9',
    numeroRadicado: '20261000009',
    dependencia: 'catastro',
    estado: 'Recibido',
    activo: true,
    creadoPor: 'ana',
    participantes: ['ana'],
    ...overrides,
  }
  const batch = writeBatch(db)
  batch.set(doc(db, 'expedientes/e9'), data)
  if (claim)
    batch.set(doc(db, 'radicadosEntrada', String(data.numeroRadicado)), { expedienteId: 'e9' })
  batch.set(doc(db, 'expedientes/e9/historial/h'), { usuario: data.creadoPor, accion: 'Creación' })
  return batch.commit()
}

test('al registrar se exige área propia, participantes y radicado de entrada único', async () => {
  await assertSucceeds(createBatch(as('ana')))
})

test('no se registra sin reservar el radicado, con uno repetido ni en otra área', async () => {
  await assertFails(createBatch(as('ana'), {}, false))
  await assertFails(createBatch(as('ana'), { numeroRadicado: '20261000001' }))
  await assertFails(createBatch(as('ana'), { dependencia: 'tesoreria' }))
  await assertFails(createBatch(as('ana'), { dependencia: 'otra' }))
  await assertFails(createBatch(as('ana'), { participantes: [] }))
  await assertFails(
    createBatch(as('ana'), { funcionarioAsignado: { uid: 'luis', nombreCompleto: 'Luis' } }),
  )
  await assertFails(
    createBatch(as('director'), { creadoPor: 'director', participantes: ['director'] }),
  )
  // Un supervisor sí elige el área.
  await assertSucceeds(
    createBatch(as('coordinator'), {
      creadoPor: 'coordinator',
      participantes: ['coordinator'],
      dependencia: 'tesoreria',
    }),
  )
})

test('solo actúa el responsable actual; quien lo tuvo antes solo consulta', async () => {
  const update = (db: Firestore, uid: string, data: Record<string, unknown> = {}) =>
    updateDoc(doc(db, 'expedientes/e1'), {
      estado: 'Radicado de salida',
      participantes: arrayUnion(uid),
      ...data,
    })
  await assertSucceeds(update(as('ana'), 'ana'))
  await assertFails(update(as('luis'), 'luis'))
  await assertFails(update(as('tesoreria'), 'tesoreria'))
  await assertFails(update(as('director'), 'director'))
  await assertSucceeds(update(as('coordinator'), 'coordinator'))
})

test('participantes no se recorta y el área solo la cambian supervisores', async () => {
  const set = (db: Firestore, data: Record<string, unknown>) =>
    updateDoc(doc(db, 'expedientes/e1'), data)
  await assertFails(set(as('ana'), { participantes: ['ana'] }))
  await assertFails(set(as('ana'), { participantes: arrayUnion('ana'), dependencia: 'tesoreria' }))
  await assertFails(
    set(as('ana'), { participantes: arrayUnion('ana'), numeroRadicado: '20261000005' }),
  )
  // Reasignar exige incluir al nuevo responsable.
  await assertFails(
    set(as('ana'), {
      participantes: arrayUnion('ana'),
      funcionarioAsignado: { uid: 'tesoreria', nombreCompleto: 'Teso' },
    }),
  )
  await assertSucceeds(
    set(as('ana'), {
      participantes: arrayUnion('ana', 'tesoreria'),
      funcionarioAsignado: { uid: 'tesoreria', nombreCompleto: 'Teso' },
    }),
  )
  await assertSucceeds(
    set(as('coordinator'), { participantes: arrayUnion('coordinator'), dependencia: 'tesoreria' }),
  )
  await assertFails(
    set(as('coordinator'), { participantes: arrayUnion('coordinator'), dependencia: 'otra' }),
  )
})

test('corregir el radicado de entrada exige reservar el nuevo número', async () => {
  const correct = (claim: boolean) => {
    const db = as('coordinator')
    const batch = writeBatch(db)
    batch.update(doc(db, 'expedientes/e1'), {
      numeroRadicado: '20261000007',
      participantes: arrayUnion('coordinator'),
    })
    if (claim) batch.set(doc(db, 'radicadosEntrada/20261000007'), { expedienteId: 'e1' })
    batch.delete(doc(db, 'radicadosEntrada/20261000001'))
    return batch.commit()
  }
  await assertFails(correct(false))
  await assertSucceeds(correct(true))
})

test('el índice de radicados de entrada no se lista ni se falsea', async () => {
  await assertSucceeds(getDoc(doc(as('tesoreria'), 'radicadosEntrada/20261000001')))
  await assertFails(getDocs(collection(as('ana'), 'radicadosEntrada')))
  await assertFails(setDoc(doc(as('ana'), 'radicadosEntrada/20261000077'), { expedienteId: 'e1' }))
  await assertFails(deleteDoc(doc(as('ana'), 'radicadosEntrada/20261000001')))
})

test('solo escribe historial y radicados quien puede gestionar el expediente', async () => {
  const history = (user: UserKey) =>
    setDoc(doc(as(user), 'expedientes/e1/historial/n'), { usuario: user, accion: 'x' })
  await assertSucceeds(history('ana'))
  await assertFails(history('luis'))
  await assertFails(history('tesoreria'))
  const filing = (user: UserKey) =>
    setDoc(doc(as(user), 'radicados/e1_20262000099'), { expedienteId: 'e1', numero: '20262000099' })
  await assertSucceeds(filing('ana'))
  await assertFails(filing('luis'))
})

test('una nota la deja quien ve el expediente y es usuario operativo, aunque no lo gestione', async () => {
  const note = (user: UserKey, noteId = 'n1') =>
    setDoc(doc(as(user), `expedientes/e1/historial/${user}-${noteId}`), {
      usuario: user,
      accion: 'Nota',
      detalle: 'Se confirmó con la planilla de Archivo.',
      fecha: serverTimestamp(),
    })
  // Luis lo tuvo antes: no gestiona, pero sí aclara.
  for (const user of ['ana', 'luis', 'admin', 'coordinator'] as const)
    await assertSucceeds(note(user))
  await assertFails(note('tesoreria'))
  await assertFails(note('director'))
  await assertFails(note('viewer'))
  await assertFails(note('inactive'))
  // También en un expediente cerrado, que el Funcionario ya no puede gestionar.
  await env.withSecurityRulesDisabled((context) =>
    updateDoc(doc(context.firestore(), 'expedientes/e1'), {
      activo: false,
      estado: 'Archivo (Finalizado)',
    }),
  )
  await assertSucceeds(note('luis', 'n2'))
})

test('la nota tiene forma estricta y no se edita ni se borra', async () => {
  const note = (data: Record<string, unknown>) =>
    setDoc(doc(as('luis'), 'expedientes/e1/historial/n'), {
      usuario: 'luis',
      accion: 'Nota',
      detalle: 'Aclaración válida.',
      fecha: serverTimestamp(),
      ...data,
    })
  await assertFails(note({ usuario: 'ana' }))
  await assertFails(note({ accion: 'Corrigió radicado de entrada' }))
  await assertFails(note({ detalle: 'ok' }))
  await assertFails(note({ detalle: 'x'.repeat(1001) }))
  await assertFails(note({ fecha: new Date('2026-01-01') }))
  await assertFails(note({ extra: true }))
  await assertFails(
    setDoc(doc(as('luis'), 'expedientes/no-existe/historial/n'), {
      usuario: 'luis',
      accion: 'Nota',
      detalle: 'Aclaración válida.',
      fecha: serverTimestamp(),
    }),
  )
  await assertSucceeds(note({}))
  await assertFails(updateDoc(doc(as('luis'), 'expedientes/e1/historial/n'), { detalle: 'Otra.' }))
  await assertFails(deleteDoc(doc(as('admin'), 'expedientes/e1/historial/n')))
})

test('la copia del radicado de entrada en Radicación solo sigue al expediente', async () => {
  const filing = (db: Firestore, value: string) =>
    updateDoc(doc(db, 'radicados/e1_20262000001'), { expedienteRadicado: value })
  // Un supervisor corrige la entrada y, en el mismo lote, la copia del radicado.
  const admin = as('admin')
  const batch = writeBatch(admin)
  batch.update(doc(admin, 'expedientes/e1'), {
    numeroRadicado: '20261000077',
    participantes: arrayUnion('admin'),
  })
  batch.set(doc(admin, 'radicadosEntrada/20261000077'), { expedienteId: 'e1' })
  batch.delete(doc(admin, 'radicadosEntrada/20261000001'))
  batch.update(doc(admin, 'radicados/e1_20262000001'), { expedienteRadicado: '20261000077' })
  await assertSucceeds(batch.commit())
  // Otro número que no es el del expediente, o un Funcionario, no.
  await assertFails(filing(as('admin'), '20261000099'))
  await assertFails(filing(as('ana'), '20261000077'))
})

/** Recordatorio como lo arma createReminders. */
function reminder(db: Firestore, id: string, data: Record<string, unknown>) {
  return setDoc(doc(db, 'recordatorios', id), {
    id,
    grupo: 'g1',
    titulo: 'Reunión de seguimiento',
    fecha: '2026-10-20',
    destinatarioUid: 'ana',
    destinatarioNombre: 'Ana',
    creadoPor: 'ana',
    creadoPorNombre: 'Ana',
    documentos: [],
    correo: 'Pendiente',
    hecho: false,
    fechaCreacion: serverTimestamp(),
    ...data,
  })
}

test('cada quien se crea recordatorios; los supervisores también a otros', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    for (const uid of ['ana', 'luis', 'admin', 'coordinator', 'director'])
      await setDoc(doc(context.firestore(), 'directorioUsuarios', uid), { uid, activo: true })
  })
  await assertSucceeds(reminder(as('ana'), 'r1', {}))
  await assertFails(reminder(as('ana'), 'r2', { destinatarioUid: 'luis' }))
  await assertSucceeds(
    reminder(as('coordinator'), 'r3', { destinatarioUid: 'luis', creadoPor: 'coordinator' }),
  )
  await assertSucceeds(reminder(as('admin'), 'r4', { destinatarioUid: 'ana', creadoPor: 'admin' }))
  await assertSucceeds(
    reminder(as('director'), 'r5', { destinatarioUid: 'director', creadoPor: 'director' }),
  )
  // Para alguien que no existe, a nombre de otro, ya enviado, con campos de más o sin título.
  await assertFails(reminder(as('admin'), 'r6', { destinatarioUid: 'nadie', creadoPor: 'admin' }))
  await assertFails(reminder(as('ana'), 'r7', { creadoPor: 'luis' }))
  await assertFails(reminder(as('ana'), 'r8', { correo: 'Enviado' }))
  await assertSucceeds(
    reminder(as('admin'), 'r12', {
      destinatarioUid: 'luis',
      creadoPor: 'admin',
      correoAviso: 'Pendiente',
    }),
  )
  await assertFails(
    reminder(as('admin'), 'r13', {
      destinatarioUid: 'luis',
      creadoPor: 'admin',
      correoAviso: 'Enviado',
    }),
  )
  await assertFails(reminder(as('ana'), 'r9', { extra: true }))
  await assertFails(reminder(as('ana'), 'r10', { titulo: 'ok' }))
  await assertFails(
    reminder(as('inactive'), 'r11', { destinatarioUid: 'inactive', creadoPor: 'inactive' }),
  )
})

test('un recordatorio lo ven quien lo recibe, quien lo creó y los supervisores', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'recordatorios/r1'), {
      destinatarioUid: 'ana',
      creadoPor: 'admin',
      titulo: 'Reunión',
      fecha: '2026-10-20',
      hecho: false,
    })
  })
  const mine = (db: Firestore, uid: string) =>
    getDocs(query(collection(db, 'recordatorios'), where('destinatarioUid', '==', uid)))
  await assertSucceeds(getDoc(doc(as('ana'), 'recordatorios/r1')))
  await assertSucceeds(mine(as('ana'), 'ana'))
  await assertSucceeds(mine(as('coordinator'), 'ana'))
  await assertFails(getDoc(doc(as('luis'), 'recordatorios/r1')))
  await assertFails(mine(as('luis'), 'ana'))
  // Quien lo recibe solo lo marca como hecho; no lo cambia ni lo borra.
  await assertSucceeds(updateDoc(doc(as('ana'), 'recordatorios/r1'), { hecho: true }))
  await assertFails(updateDoc(doc(as('ana'), 'recordatorios/r1'), { titulo: 'Otro' }))
  await assertFails(updateDoc(doc(as('admin'), 'recordatorios/r1'), { hecho: false }))
  await assertFails(deleteDoc(doc(as('ana'), 'recordatorios/r1')))
  await assertSucceeds(deleteDoc(doc(as('admin'), 'recordatorios/r1')))
})

test('sin responsable, solo quien lo registró lo gestiona', async () => {
  await env.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), 'expedientes/e3'), {
      ...anaExpedient,
      id: 'e3',
      funcionarioAsignado: null,
      participantes: ['ana'],
    }),
  )
  const update = (user: UserKey) =>
    updateDoc(doc(as(user), 'expedientes/e3'), {
      participantes: arrayUnion(user),
      estado: 'Asignado',
    })
  await assertFails(update('luis'))
  await assertSucceeds(update('ana'))
})

test('el directorio admite el área', async () => {
  const entry = {
    uid: 'ana',
    nombreCompleto: 'Ana',
    rol: 'Funcionario',
    activo: true,
    dependencia: 'catastro',
  }
  await assertSucceeds(setDoc(doc(as('admin'), 'directorioUsuarios/ana'), entry))
  await assertFails(setDoc(doc(as('admin'), 'directorioUsuarios/ana'), { ...entry, correo: 'x' }))
})

test('quien apoya la respuesta puede consultar el expediente, no gestionarlo', async () => {
  await assertSucceeds(
    updateDoc(doc(as('ana'), 'expedientes/e1'), {
      apoyosRespuesta: arrayUnion({
        dependencia: 'tesoreria',
        persona: 'Teso',
        personaUid: 'tesoreria',
      }),
      participantes: arrayUnion('ana', 'tesoreria'),
    }),
  )
  await assertSucceeds(getDoc(doc(as('tesoreria'), 'expedientes/e1')))
  await assertFails(
    updateDoc(doc(as('tesoreria'), 'expedientes/e1'), {
      estado: 'Archivo (Finalizado)',
      participantes: arrayUnion('tesoreria'),
    }),
  )
})

test('la clase de correspondencia es Externa o Interna', async () => {
  await assertSucceeds(createBatch(as('ana'), { clase: 'Interna', numeroRadicado: '2026-000009' }))
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'usuarios/ana'), { activo: true, ...users.ana })
  })
  await assertFails(createBatch(as('ana'), { clase: 'Otra' }))
})

test('solo los supervisores cambian la clase de correspondencia', async () => {
  const change = (db: Firestore) =>
    updateDoc(doc(db, 'expedientes/e1'), { clase: 'Interna', participantes: arrayUnion('ana') })
  await assertFails(change(as('ana')))
  await assertSucceeds(
    updateDoc(doc(as('coordinator'), 'expedientes/e1'), {
      clase: 'Interna',
      participantes: arrayUnion('coordinator'),
    }),
  )
  await assertFails(
    updateDoc(doc(as('coordinator'), 'expedientes/e1'), {
      clase: 'Otra',
      participantes: arrayUnion('coordinator'),
    }),
  )
})
