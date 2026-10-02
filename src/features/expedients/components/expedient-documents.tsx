import { Card } from '@/components/ui/card'
import type { WorkflowDocument } from '@/types/expedient'

export function ExpedientDocuments({ documents }: { documents: WorkflowDocument[] }) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-semibold">Documentos asociados</h3>
      {documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map((document) => (
            <div key={document.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{document.nombre}</p>
                  <p className="text-xs text-slate-500">{document.tipo.replace('_', ' ')}</p>
                  {document.radicadoNumero && (
                    <p className="mt-1 text-xs text-slate-500">
                      Radicado: {document.radicadoNumero}
                      {document.radicadoFecha
                        ? ` • ${document.radicadoFecha.toDate().toLocaleDateString('es-CO')}`
                        : ''}
                    </p>
                  )}
                </div>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary"
                >
                  Ver enlace
                </a>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>{document.usuario}</span>
                <span>{document.fecha?.toDate().toLocaleString('es-CO')}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600">No hay documentos de workflow asociados todavía.</p>
      )}
    </Card>
  )
}
