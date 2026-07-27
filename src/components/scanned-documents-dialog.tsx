import { Link, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { DocumentType, ScannedDocument } from '@/types/expedient'

const DOCUMENT_TYPES: { label: string; value: DocumentType }[] = [
  { label: 'Radicado Inicial', value: 'Radicado Inicial' },
  { label: 'Respuesta Radicada', value: 'Respuesta Radicada' },
  { label: 'Traslado con Radicado', value: 'Traslado con Radicado' },
  { label: 'Respuesta Traslado', value: 'Respuesta Traslado' },
]

// Carpeta documental centralizada (OneDrive / SharePoint)
const DEFAULT_ONEDRIVE_FOLDER =
  'https://girardotaa-my.sharepoint.com/my?id=%2Fpersonal%2Fauxiliar%5Fcatastro3%5Fgirardota%5Fgov%5Fco%2FDocuments%2FSIGECAT%5FBD&viewid=faca467a%2D010d%2D4c66%2D822b%2D24e5b5fbb6c1'

interface ScannedDocumentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (document: Omit<ScannedDocument, 'id' | 'fechaEscaneo' | 'creadoPor'>) => void
  documents: ScannedDocument[]
  onDelete: (documentId: string) => void
}

export function ScannedDocumentsDialog({
  open,
  onOpenChange,
  onSubmit,
  documents,
  onDelete,
}: ScannedDocumentsDialogProps) {
  const [documentType, setDocumentType] = useState<DocumentType>('Radicado Inicial')
  const [radicado, setRadicado] = useState('')
  const [urlOneDrive, setUrlOneDrive] = useState('')

  const openFolder = () => {
    window.open(DEFAULT_ONEDRIVE_FOLDER, '_blank', 'noopener,noreferrer')
  }

  const handleSubmit = () => {
    if (!radicado.trim() || !urlOneDrive.trim()) {
      alert('Por favor completa todos los campos')
      return
    }

    if (!urlOneDrive.trim().startsWith('https://')) {
      alert('La URL debe iniciar con https://')
      return
    }

    onSubmit({
      tipo: documentType,
      radicado: radicado.trim(),
      urlOneDrive: urlOneDrive.trim(),
    })

    setRadicado('')
    setUrlOneDrive('')
    setDocumentType('Radicado Inicial')
  }

  // Sugerencia y autocompletado de URL basada en carpeta + número de radicado y tipo
  const makeSlug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '')
  const suggestedFilename = `${radicado.trim() ? radicado.trim() : 'documento'}_${makeSlug(documentType)}`.replace(/_+/g, '_')
  const suggestedUrl = `${DEFAULT_ONEDRIVE_FOLDER.replace(/\/$/, '')}/${suggestedFilename}.pdf`

  // Autocompletar al salir del campo radicado sólo si el campo URL está vacío
  const handleRadicadoBlur = () => {
    if (!urlOneDrive && radicado.trim()) setUrlOneDrive(suggestedUrl)
  }

  return (
    <div className={`fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 ${open ? '' : 'hidden'}`}>
      <Card className="w-full max-w-lg space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Gestionar Documentos Escaneados</h2>
          <p className="mt-1 text-sm text-slate-500">Agrega enlaces a los documentos escaneados desde OneDrive</p>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Carpeta documental</p>
                <p className="mt-1 text-sm text-slate-700">SIGECAT · Carpeta centralizada en OneDrive</p>
              </div>
              <div>
                <Button variant="default" size="sm" onClick={openFolder} className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                  Abrir OneDrive →
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 break-words">{DEFAULT_ONEDRIVE_FOLDER}</p>
          </div>

          <div>
            <label className="block text-sm font-medium">Tipo de Documento</label>
            <Select value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium">Número de Radicado</label>
            <Input
              placeholder="Ej: 202400001234"
              value={radicado}
              onChange={(e) => setRadicado(e.target.value)}
              onBlur={handleRadicadoBlur}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">URL de OneDrive (documento)</label>
            <div className="flex gap-2">
              <Input
                placeholder={DEFAULT_ONEDRIVE_FOLDER}
                value={urlOneDrive}
                onChange={(e) => setUrlOneDrive(e.target.value)}
                type="url"
                aria-label="URL de OneDrive"
              />
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setUrlOneDrive(suggestedUrl)}
              >
                Usar sugerido
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500 break-words">
              Sugerencia: <span className="font-mono text-xs text-slate-700">{suggestedUrl}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">Pega la URL pública o compartida del documento dentro de la carpeta del expediente en OneDrive.</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1">
              Agregar Documento
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
              Cerrar
            </Button>
          </div>
        </div>

        {documents.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="mb-3 font-medium">Documentos Registrados ({documents.length})</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{doc.tipo}</p>
                    <p className="text-xs text-slate-500">Radicado: {doc.radicado}</p>
                    <a href={doc.urlOneDrive} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                      <Link size={12} />
                      Ver en OneDrive
                    </a>
                  </div>
                  <button onClick={() => onDelete(doc.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
