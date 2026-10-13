import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { addBusinessDays, toDateKey } from '../src/lib/expedient-deadline'

/**
 * Recalcula la fecha límite de los expedientes guardados antes de que el término descontara
 * los festivos nacionales de Colombia: fecha de radicado + término del trámite + días
 * ampliados, en días hábiles. La fecha de recibido no interviene. Sin --apply solo lista.
 *
 * npx tsx scripts/recalculate-deadlines.ts [--apply] [--ids=id1,id2]
 */
const apply = process.argv.includes('--apply')
const only = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',')
const serviceAccountPath = path.resolve(
  process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH?.trim().replace(/^["']|["']$/g, '') ||
    'secrets/firebase-admin.json',
)
const app =
  getApps()[0] ??
  initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const firestore = getFirestore(app)

const [configuration, procedureTypes, expedients] = await Promise.all([
  firestore.doc('configuracion/reglasNegocio').get(),
  firestore.collection('tiposTramite').get(),
  firestore.collection('expedientes').get(),
])
const holidays: string[] = configuration.data()?.diasFestivos ?? []
const responseDays = new Map(
  procedureTypes.docs.map((item) => [item.id, item.data().diasRespuesta as number]),
)

let pending = 0
for (const snapshot of expedients.docs) {
  if (only && !only.includes(snapshot.id)) continue
  const data = snapshot.data()
  if (!data.fechaRadicado || !data.fechaLimite) continue
  const term: number | undefined = data.diasTermino ?? responseDays.get(data.tipoTramiteId)
  if (!term) {
    console.log(`REVISAR  ${snapshot.id}  ${data.numeroRadicado}  (sin término del trámite)`)
    continue
  }
  const filingDate = (data.fechaRadicado as Timestamp).toDate()
  const deadline = addBusinessDays(filingDate, term + (data.diasAmpliacion ?? 0), holidays)
  const current = toDateKey((data.fechaLimite as Timestamp).toDate())
  if (current === toDateKey(deadline)) continue

  pending++
  console.log(
    `CORREGIR ${snapshot.id}  ${data.numeroRadicado}  radicado ${toDateKey(filingDate)}  ${term}+${data.diasAmpliacion ?? 0} días: ${current} → ${toDateKey(deadline)}${data.activo ? '' : '  (cerrado)'}`,
  )
  if (!apply) continue
  const batch = firestore.batch()
  batch.update(snapshot.ref, {
    fechaLimite: Timestamp.fromDate(deadline),
    diasTermino: term,
    fechaActualizacion: FieldValue.serverTimestamp(),
  })
  batch.set(snapshot.ref.collection('historial').doc(), {
    usuario: 'sistema',
    accion: 'Recalculó la fecha límite',
    detalle: `${current} → ${toDateKey(deadline)}: se descuentan los festivos nacionales de Colombia desde la fecha de radicado.`,
    fecha: FieldValue.serverTimestamp(),
  })
  await batch.commit()
}

console.log(
  pending
    ? `${pending} expediente(s) ${apply ? 'corregidos' : 'por corregir; vuelve a ejecutar con --apply'}.`
    : 'Todas las fechas límite están bien calculadas.',
)
