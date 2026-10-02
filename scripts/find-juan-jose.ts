import { readFile } from 'node:fs/promises'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const credentials = JSON.parse(await readFile('secrets/firebase-admin.json', 'utf8')) as Record<string, string>
const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) })
const firestore = getFirestore(app)
const snapshot = await firestore.collection('usuarios').get()
const matches = snapshot.docs.filter((item) => item.data().nombreCompleto?.toLowerCase().includes('juan jose gomez'))
process.stdout.write(matches.map((item) => `${item.id}\t${item.data().nombreCompleto}\t${item.data().rol}\n`).join(''))
