/** Solo se aceptan enlaces HTTPS del OneDrive o SharePoint institucional. */
export function isInstitutionalDocumentUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return (
      url.protocol === 'https:' &&
      (host.endsWith('.sharepoint.com') || host.endsWith('.onedrive.com') || host === '1drv.ms')
    )
  } catch {
    return false
  }
}

export interface NewDocumentLink {
  nombre: string
  url: string
  folios?: number
}

/** Valida y normaliza un enlace de documento; devuelve el error o el documento listo. */
export function parseDocumentLink(
  name: string,
  url: string,
  folios = '',
): { error: string } | { document: NewDocumentLink } {
  const nombre = name.trim()
  const link = url.trim()
  if (!nombre || !link) return { error: 'Escribe el nombre del documento y pega su enlace.' }
  if (!isInstitutionalDocumentUrl(link))
    return { error: 'Usa un enlace HTTPS de OneDrive o SharePoint institucional.' }
  const pages = folios.trim() ? Number(folios) : undefined
  if (pages !== undefined && (!Number.isInteger(pages) || pages < 1))
    return { error: 'Los folios deben ser un número entero mayor que cero.' }
  return { document: { nombre, url: link, ...(pages ? { folios: pages } : {}) } }
}
