import assert from 'node:assert/strict'
import test from 'node:test'
import { isStaleBuildError, reloadForNewVersion } from './stale-build'

test('reconoce el archivo faltante de una versión anterior en cada navegador', () => {
  assert.equal(
    isStaleBuildError(
      new TypeError(
        'Failed to fetch dynamically imported module: https://x/assets/historical-page-D7KudP47.js',
      ),
    ),
    true,
  )
  assert.equal(isStaleBuildError(new TypeError('error loading dynamically imported module')), true)
  assert.equal(isStaleBuildError(new TypeError('Importing a module script failed.')), true)
  assert.equal(isStaleBuildError(new Error('Unable to preload CSS for /assets/x.css')), true)
  assert.equal(isStaleBuildError(new Error('No tienes permisos')), false)
  assert.equal(isStaleBuildError(undefined), false)
})

test('recarga una vez y no vuelve a recargar enseguida', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  }
  let reloads = 0
  const reload = () => void reloads++
  assert.equal(reloadForNewVersion(storage, reload, 1_000_000), true)
  assert.equal(reloadForNewVersion(storage, reload, 1_010_000), false)
  assert.equal(reloads, 1)
  // Pasado el intervalo, una publicación posterior vuelve a recargar.
  assert.equal(reloadForNewVersion(storage, reload, 1_040_000), true)
  assert.equal(reloads, 2)
})
