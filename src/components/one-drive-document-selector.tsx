import { CheckCircle2, CircleAlert, ExternalLink, FileText, FolderOpen, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { parseDocumentLink, type NewDocumentLink } from '@/lib/document-links'
import { cn } from '@/lib/utils'
import {
  WORKFLOW_DOCUMENT_LABELS,
  type WorkflowDocument,
  type WorkflowDocumentType,
} from '@/types/expedient'

// Carpeta institucional por defecto cuando el expediente no tiene una propia.
export const DEFAULT_ONEDRIVE_FOLDER =
  'https://girardotaa-my.sharepoint.com/my?id=%2Fpersonal%2Fauxiliar%5Fcatastro3%5Fgirardota%5Fgov%5Fco%2FDocuments%2FSIGECAT%5FBD&viewid=faca467a%2D010d%2D4c66%2D822b%2D24e5b5fbb6c1'

interface OneDriveDocumentSelectorProps {
  folderUrl?: string
  documents: WorkflowDocument[]
  description: string
  requiredDocumentType?: WorkflowDocumentType
  isLoading?: boolean
  onAddDocument: (document: NewDocumentLink) => void
}

export function OneDriveDocumentSelector({
  folderUrl,
  documents,
  description,
  requiredDocumentType,
  isLoading = false,
  onAddDocument,
}: OneDriveDocumentSelectorProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [folios, setFolios] = useState('')
  const [error, setError] = useState('')
  const targetFolder = folderUrl?.trim() || DEFAULT_ONEDRIVE_FOLDER
  const stepDocuments = requiredDocumentType
    ? documents.filter((document) => document.tipo === requiredDocumentType)
    : documents
  const hasRequiredDocument = stepDocuments.length > 0

  const submit = () => {
    const result = parseDocumentLink(name, url, folios)
    if ('error' in result) {
      setError(result.error)
      return
    }
    onAddDocument(result.document)
    setName('')
    setUrl('')
    setFolios('')
    setError('')
    setFormOpen(false)
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        hasRequiredDocument
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-amber-200 bg-amber-50/50',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full',
              hasRequiredDocument
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700',
            )}
          >
            {hasRequiredDocument ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}
          </span>
          <div>
            <p className="font-semibold text-slate-900">
              {requiredDocumentType ? WORKFLOW_DOCUMENT_LABELS[requiredDocumentType] : 'Documentos'}
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                {hasRequiredDocument ? 'Asociado' : 'Obligatorio'}
              </span>
            </p>
            <p className="mt-0.5 text-sm text-slate-600">{description}</p>
          </div>
        </div>
        <a
          href={targetFolder}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-info hover:underline"
        >
          <FolderOpen size={16} /> Abrir carpeta OneDrive
        </a>
      </div>

      {stepDocuments.length > 0 && (
        <ul className="mt-3 space-y-2">
          {stepDocuments.map((document) => (
            <li key={document.id}>
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2 text-sm transition hover:border-primary/50"
              >
                <FileText size={16} className="shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                  {document.nombre}
                </span>
                {document.folios && (
                  <span className="text-xs text-muted-foreground">{document.folios} folios</span>
                )}
                <ExternalLink size={14} className="shrink-0 text-slate-400" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {formOpen ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-white p-4">
          <p className="text-xs text-muted-foreground">
            Sube el escaneo a OneDrive, usa <b>Compartir → Copiar vínculo</b> y pégalo aquí.
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <Field label="Nombre del documento" required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Radicado de entrada escaneado"
              />
            </Field>
            <Field label="Folios">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={folios}
                onChange={(event) => setFolios(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Enlace de OneDrive o SharePoint" required error={error || undefined}>
            <Input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submit()
                }
              }}
              placeholder="https://girardotaa-my.sharepoint.com/…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} disabled={isLoading}>
              {isLoading ? 'Asociando…' : 'Asociar documento'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setFormOpen(true)}
          disabled={isLoading}
        >
          <Plus size={16} /> {hasRequiredDocument ? 'Asociar otro documento' : 'Asociar documento'}
        </Button>
      )}
    </div>
  )
}
