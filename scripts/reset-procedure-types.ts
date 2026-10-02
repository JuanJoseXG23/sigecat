import { readFile } from 'node:fs/promises'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const credentials = JSON.parse(await readFile('secrets/firebase-admin.json', 'utf8')) as Record<string, string>
const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) })
const firestore = getFirestore(app)
const snapshot = await firestore.collection('tiposTramite').get()
const batch = firestore.batch()
snapshot.docs.forEach((item) => batch.update(item.ref, { activo: false, fechaActualizacion: new Date() }))
await batch.commit()
process.stdout.write(`Se desactivaron ${snapshot.size} tipos de trámite.\n`)
