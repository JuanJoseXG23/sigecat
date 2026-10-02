import { readFile } from 'node:fs/promises'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const credentials = JSON.parse(await readFile('secrets/firebase-admin.json', 'utf8')) as Record<string, string>
const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) })
const firestore = getFirestore(app)
const filings = await firestore.collection('radicados').get()
const expedients = await firestore.collection('expedientes').get()
const batch = firestore.batch()
filings.docs.forEach((item) => batch.delete(item.ref))
let historyCount = 0
for (const expedient of expedients.docs) {
  const history = await expedient.ref.collection('historial').get()
  history.docs.forEach((item) => batch.delete(item.ref))
  historyCount += history.size
}
await batch.commit()
process.stdout.write(`Se eliminaron ${filings.size} radicados y ${historyCount} registros de historial.\n`)
