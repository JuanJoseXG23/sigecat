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
