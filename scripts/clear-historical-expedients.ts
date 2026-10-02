import { readFile } from 'node:fs/promises'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const credentials = JSON.parse(await readFile('secrets/firebase-admin.json', 'utf8')) as Record<string, string>
const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) })
const firestore = getFirestore(app)
const expedients = await firestore.collection('expedientes').get()
const historical = expedients.docs.filter((item) => {
  const data = item.data()
  return data.activo === false || ['Archivo (Finalizado)', 'Finalizado', 'Archivado'].includes(data.estado)
})

let deleted = 0
for (const expedient of historical) {
  const batch = firestore.batch()
  for (const collectionName of ['historial', 'observaciones']) {
    const children = await expedient.ref.collection(collectionName).get()
    children.docs.forEach((item) => batch.delete(item.ref))
  }
  batch.delete(expedient.ref)
  await batch.commit()
  deleted += 1
}
process.stdout.write(`Se eliminaron ${deleted} expedientes históricos.\n`)
