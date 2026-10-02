import { readFile } from 'node:fs/promises'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const credentials = JSON.parse(await readFile('secrets/firebase-admin.json', 'utf8')) as Record<string, string>
const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) })
const firestore = getFirestore(app)
const snapshot = await firestore.collection('tareas').get()
const batch = firestore.batch()
snapshot.docs.forEach((item) => batch.delete(item.ref))
await batch.commit()
process.stdout.write(`Se eliminaron ${snapshot.size} tareas.\n`)
