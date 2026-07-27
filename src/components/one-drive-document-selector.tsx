import { useMemo, useState } from 'react'
import { CheckCircle2, Cloud, ExternalLink, FileText, Plus, CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { WorkflowDocument, WorkflowDocumentType } from '@/types/expedient'

// Carpeta global fallback
const DEFAULT_ONEDRIVE_FOLDER =
  'https://girardotaa-my.sharepoint.com/my?id=%2Fpersonal%2Fauxiliar%5Fcatastro3%5Fgirardota%5Fgov%5Fco%2FDocuments%2FSIGECAT%5FBD&viewid=faca467a%2D010d%2D4c66%2D822b%2D24e5b5fbb6c1'

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
  addButtonLabel = 'Agregar documento en OneDrive',
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

  const targetFolder = (folderUrl && folderUrl.trim()) || DEFAULT_ONEDRIVE_FOLDER
  const handleSubmit = () => {
    const documentName = nombre.trim()
    const documentUrl = url.trim()

    if (!documentName || !documentUrl) {
      setError('Por favor completa todos los campos obligatorios (nombre y URL).')
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
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-full bg-sky-50 text-sky-600">
              <Cloud size={24} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Carpeta de OneDrive</p>
              <p className="mt-1 text-sm text-slate-500">
                {targetFolder
                  ? 'Abre la carpeta documental asociada al expediente.'
                  : 'Aún no existe carpeta documental.'}
              </p>
            </div>
          </div>
          <a
            href={targetFolder}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-emerald-600 bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <ExternalLink size={18} className="mr-2" />
            Abrir OneDrive
          </a>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold text-slate-900">Documentos requeridos</p>
              <p className="mt-1 max-w-xl text-sm text-slate-600 break-words">{description}</p>
            </div>
            <Button
              variant="outline"
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-emerald-600 px-4 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setIsDialogOpen(true)}
              disabled={isLoading}
            >
              <Plus size={18} />
              <span>{addButtonLabel}</span>
            </Button>
          </div>
          {requiredDocumentType && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`grid size-11 place-items-center rounded-full ${hasRequiredDocument ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}
                >
                  <FileText size={21} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {requiredDocumentType.replace('_', ' ')}
                  </p>
                  <p className="text-sm text-slate-500">Documento obligatorio</p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${hasRequiredDocument ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-700'}`}
              >
                {hasRequiredDocument ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
                {hasRequiredDocument ? 'Documento asociado' : 'Falta documento'}
              </span>
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

      <div
        className={`${isDialogOpen ? '' : 'hidden'} fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4`}
      >
        <Card className="w-full max-w-2xl p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Agregar documento de OneDrive</h2>
              <p className="text-sm text-slate-500">
                Registra el nombre y la URL pública del documento escaneado.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Nombre del documento
                </label>
                <Input
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Ej: Radicado recibido"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  URL del documento en OneDrive
                </label>
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
