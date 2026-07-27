import { useMemo, useState } from 'react'
import { AlertCircle, ExternalLink, FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { WorkflowDocument, WorkflowDocumentType } from '@/types/expedient'

interface OneDriveDocumentSelectorProps {
  folderUrl?: string
  documents: WorkflowDocument[]
  description: string
  requiredDocumentType?: WorkflowDocumentType
  addButtonLabel?: string
  isLoading?: boolean
  onAddDocument: (document: { nombre: string; url: string }) => void
}

export function OneDriveDocumentSelector({
  folderUrl,
  documents,
  description,
  requiredDocumentType,
  addButtonLabel = '+ Agregar documento en OneDrive',
  isLoading = false,
  onAddDocument,
}: OneDriveDocumentSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const hasRequiredDocument = useMemo(
    () => !requiredDocumentType || documents.some((doc) => doc.tipo === requiredDocumentType),
    [documents, requiredDocumentType],
  )

  const handleOpenFolder = () => {
    if (!folderUrl) return
    window.open(folderUrl, '_blank', 'noopener,noreferrer')
  }

  const handleSubmit = () => {
    const documentName = nombre.trim()
    const documentUrl = url.trim()

    if (!documentName || !documentUrl) {
      setError('Por favor completa todos los campos.')
      return
    }
    if (!documentUrl.startsWith('https://')) {
      setError('La URL debe iniciar con https://')
      return
    }

    onAddDocument({ nombre: documentName, url: documentUrl })
    setNombre('')
    setUrl('')
    setError('')
    setIsDialogOpen(false)
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Carpeta de OneDrive</p>
              <p className="mt-2 text-sm text-slate-600">
                {folderUrl
                  ? 'Abre la carpeta documental asociada al expediente.'
                  : 'Aún no existe carpeta documental.'}
              </p>
            </div>
            <Button
              variant="default"
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleOpenFolder}
              disabled={!folderUrl}
            >
              <span>Abrir OneDrive →</span>
            </Button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-900">
                <FileText size={18} />
                <div>
                  <p className="font-semibold">Documentos requeridos</p>
                  <p className="text-sm text-slate-600">{description}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="rounded-full border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                onClick={() => setIsDialogOpen(true)}
                disabled={isLoading}
              >
                <Plus size={16} />
                {addButtonLabel}
              </Button>
            </div>
            {requiredDocumentType && !hasRequiredDocument && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
                <AlertCircle size={16} />
                <span>Falta documento requerido: {requiredDocumentType.replace('_', ' ')}</span>
              </div>
            )}
            {documents.length > 0 && (
              <div className="mt-4 space-y-2">
                {documents.map((document) => (
                  <a
                    key={document.id}
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-semibold">{document.nombre}</p>
                      <p className="text-xs text-slate-500">{document.tipo.replace('_', ' ')}</p>
                    </div>
                    <ExternalLink size={16} className="text-slate-500" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className={`${isDialogOpen ? '' : 'hidden'} fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4`}>
        <Card className="w-full max-w-lg p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Agregar documento de OneDrive</h2>
              <p className="text-sm text-slate-500">Registra el nombre y la URL pública del documento escaneado.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nombre del documento</label>
                <Input
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Ej: Radicado recibido"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">URL del documento en OneDrive</label>
                <Input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false)
                  setError('')
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                Guardar documento
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
