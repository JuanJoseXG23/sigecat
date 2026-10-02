import { FileText, Link as LinkIcon, Plus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ScannedDocument } from '@/types/expedient'

interface ScannedDocumentsCardProps {
  documents: ScannedDocument[]
  isLoading?: boolean
  onAddClick: () => void
  requiredDocumentType?: string
}

export function ScannedDocumentsCard({
  documents,
  isLoading = false,
  onAddClick,
  requiredDocumentType,
}: ScannedDocumentsCardProps) {
  const hasRequiredDocument = requiredDocumentType
    ? documents.some((doc) => doc.tipo === requiredDocumentType)
    : true

  return (
    <Card className={`p-4 ${requiredDocumentType && !hasRequiredDocument ? 'border-orange-200 bg-orange-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-slate-600" />
            <h3 className="font-semibold">Documentos Escaneados</h3>
          </div>
          <p className="mt-1 text-sm text-slate-600">{documents.length} documento(s) registrado(s)</p>

          {requiredDocumentType && !hasRequiredDocument && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-100 p-2 text-xs text-orange-700">
              <AlertCircle size={14} />
              <span>Se requiere escanear: {requiredDocumentType}</span>
            </div>
          )}

          {documents.length > 0 && (
            <div className="mt-3 space-y-2">
              {documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.urlOneDrive}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border p-2 text-sm hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-slate-700">{doc.tipo}</p>
                    <p className="text-xs text-slate-500">Radicado: {doc.radicado}</p>
                  </div>
                  <LinkIcon size={14} className="text-primary flex-shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={onAddClick}
          disabled={isLoading}
          size="sm"
          className="flex gap-2 whitespace-nowrap ml-4"
        >
          <Plus size={16} />
          Agregar
        </Button>
      </div>
    </Card>
  )
}
