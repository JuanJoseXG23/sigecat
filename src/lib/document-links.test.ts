import assert from 'node:assert/strict'
import test from 'node:test'
import { isInstitutionalDocumentUrl, parseDocumentLink } from './document-links'

test('acepta solo enlaces HTTPS de OneDrive o SharePoint', () => {
  assert.equal(isInstitutionalDocumentUrl('https://girardotaa-my.sharepoint.com/x'), true)
  assert.equal(isInstitutionalDocumentUrl('https://1drv.ms/b/abc'), true)
  assert.equal(isInstitutionalDocumentUrl('http://girardotaa-my.sharepoint.com/x'), false)
  assert.equal(isInstitutionalDocumentUrl('https://sharepoint.com.example.org/x'), false)
  assert.equal(isInstitutionalDocumentUrl('no es un enlace'), false)
})

test('normaliza el documento y sus folios', () => {
  assert.deepEqual(parseDocumentLink(' Oficio ', ' https://1drv.ms/b/abc ', '3'), {
    document: { nombre: 'Oficio', url: 'https://1drv.ms/b/abc', folios: 3 },
  })
  assert.deepEqual(parseDocumentLink('Oficio', 'https://1drv.ms/b/abc', ''), {
    document: { nombre: 'Oficio', url: 'https://1drv.ms/b/abc' },
  })
})

test('rechaza datos incompletos, enlaces externos y folios inválidos', () => {
  assert.ok('error' in parseDocumentLink('', 'https://1drv.ms/b/abc'))
  assert.ok('error' in parseDocumentLink('Oficio', 'https://drive.google.com/x'))
  assert.ok('error' in parseDocumentLink('Oficio', 'https://1drv.ms/b/abc', '0'))
  assert.ok('error' in parseDocumentLink('Oficio', 'https://1drv.ms/b/abc', '2.5'))
})
