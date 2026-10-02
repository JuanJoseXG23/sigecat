import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { hasReplacedEntryFiling, suggestEntryFiling } from '../src/lib/entry-filing'

/**
 * Restaura el radicado de entrada de los expedientes en que se reemplazó por un radicado de
 * respuesta, traslado o ampliación. Sin --apply solo lista los cambios.
 *
 * npx tsx scripts/fix-entry-filings.ts [--apply]
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

const expedients = await firestore.collection('expedientes').get()
const used = new Set(expedients.docs.map((item) => String(item.data().numeroRadicado).trim()))
let pending = 0
for (const snapshot of expedients.docs) {
  const expedient = snapshot.data() as Parameters<typeof hasReplacedEntryFiling>[0]
  if (!hasReplacedEntryFiling(expedient)) continue
  if (only && !only.includes(snapshot.id)) continue
  const wrong = expedient.numeroRadicado
  const entry = suggestEntryFiling(expedient)
  const applicant = (snapshot.data().solicitantes?.[0]?.nombre as string) ?? ''
  if (!entry || used.has(entry)) {
    console.log(
      `REVISAR  ${snapshot.id}  ${wrong}  ${applicant}  (${entry ? `${entry} ya existe en otro expediente` : 'sin sugerencia'})`,
    )
    continue
  }
  pending++
  const [filings, tasks] = await Promise.all([
    firestore.collection('radicados').where('expedienteId', '==', snapshot.id).get(),
    firestore.collection('tareas').where('expedienteId', '==', snapshot.id).get(),
  ])
  console.log(
    `CORREGIR ${snapshot.id}  ${wrong} → ${entry}  ${applicant}  (${filings.size} radicados, ${tasks.size} tareas)`,
  )
  if (!apply) continue
  const batch = firestore.batch()
  batch.update(snapshot.ref, {
    numeroRadicado: entry,
    fechaActualizacion: FieldValue.serverTimestamp(),
  })
  for (const item of [...filings.docs, ...tasks.docs])
    batch.update(item.ref, { expedienteRadicado: entry })
  batch.set(snapshot.ref.collection('historial').doc(), {
    usuario: 'sistema',
    accion: 'Corrigió radicado de entrada',
    detalle: `${wrong} → ${entry}`,
    fecha: FieldValue.serverTimestamp(),
  })
  await batch.commit()
  used.add(entry)
}
console.log(apply ? `Corregidos: ${pending}` : `Por corregir: ${pending} (ejecuta con --apply)`)
