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

  const handleSubmit = () => {
    if (!radicado.trim() || !urlOneDrive.trim()) {
      alert('Por favor completa todos los campos')
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

  return (
    <div className={`fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 ${open ? '' : 'hidden'}`}>
      <Card className="w-full max-w-lg space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Gestionar Documentos Escaneados</h2>
          <p className="mt-1 text-sm text-slate-500">
            Agrega enlaces a los documentos escaneados desde OneDrive
          </p>
        </div>

        <div className="space-y-3">
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium">URL de OneDrive</label>
            <Input
              placeholder="Ej: https://girardotaa-my.sharepoint.com/..."
              value={urlOneDrive}
              onChange={(e) => setUrlOneDrive(e.target.value)}
              type="url"
            />
            <p className="mt-1 text-xs text-slate-500">
              Copia el enlace compartido de la carpeta del documento en OneDrive
            </p>
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
                    <a
                      href={doc.urlOneDrive}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <Link size={12} />
                      Ver en OneDrive
                    </a>
                  </div>
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                  >
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
