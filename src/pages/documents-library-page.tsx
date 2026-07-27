import { useState, useMemo } from 'react'
import { Link, FileText, ExternalLink, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDocumentsLibrary } from '@/hooks/use-documents-library'

export function DocumentsLibraryPage() {
  const { data: expedients = [], isLoading } = useDocumentsLibrary()
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedExpedient, setExpandedExpedient] = useState<string | null>(null)

  const filteredExpedients = useMemo(() => {
    if (!searchTerm) return expedients

    const term = searchTerm.toLowerCase()
    return expedients
      .map((exp) => ({
        ...exp,
        documentos: exp.documentos.filter(
          (doc) =>
            doc.radicado.toLowerCase().includes(term) ||
            doc.tipo.toLowerCase().includes(term) ||
            exp.numeroRadicado.toLowerCase().includes(term)
        ),
      }))
      .filter((exp) => exp.numeroRadicado.toLowerCase().includes(term) || exp.documentos.length > 0)
  }, [expedients, searchTerm])

  const totalDocuments = filteredExpedients.reduce((sum, exp) => sum + exp.documentos.length, 0)

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case 'Radicado Inicial':
        return '📥'
      case 'Respuesta Radicada':
        return '📤'
      case 'Traslado con Radicado':
        return '🔄'
      case 'Respuesta Traslado':
        return '💬'
      default:
        return '📄'
    }
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Gestor de Documentos</p>
        <h1 className="text-2xl font-semibold">Biblioteca de Documentos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Accede a todos los documentos escaneados organizados por expediente.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <Input
              placeholder="Buscar por radicado o número de expediente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg">
            <FileText size={18} className="text-slate-600" />
            <span className="text-sm font-medium text-slate-700">{filteredExpedients.length} expedientes</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg">
            <Link size={18} className="text-slate-600" />
            <span className="text-sm font-medium text-slate-700">{totalDocuments} documentos</span>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-slate-500">Cargando documentos...</p>
        </Card>
      ) : filteredExpedients.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="mx-auto text-slate-400 mb-2" size={32} />
          <p className="text-slate-500">
            {searchTerm ? 'No se encontraron documentos para tu búsqueda.' : 'No hay documentos escaneados.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredExpedients.map((expedient) => (
            <Card
              key={expedient.id}
              className="overflow-hidden transition-all hover:shadow-md"
            >
              <button
                onClick={() =>
                  setExpandedExpedient(expandedExpedient === expedient.id ? null : expedient.id)
                }
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div className="flex-shrink-0">
                    {expandedExpedient === expedient.id ? (
                      <ChevronUp className="text-slate-600" size={20} />
                    ) : (
                      <ChevronDown className="text-slate-600" size={20} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">
                      Radicado: {expedient.numeroRadicado}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {expedient.solicitantes[0]?.nombre ?? 'Sin solicitante'} •{' '}
                      {expedient.predios[0]?.municipio ?? 'Sin municipio'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{expedient.documentos.length} documentos</Badge>
                    <Badge variant={expedient.estado === 'Archivo (Finalizado)' ? 'success' : 'info'}>
                      {expedient.estado}
                    </Badge>
                  </div>
                </div>
              </button>

              {expandedExpedient === expedient.id && (
                <div className="border-t bg-slate-50 p-4">
                  <div className="space-y-2">
                    {expedient.documentos.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.urlOneDrive}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xl flex-shrink-0">{getDocumentTypeIcon(doc.tipo)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-slate-900 group-hover:text-primary transition-colors">
                              {doc.tipo}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              Radicado: {doc.radicado} •{' '}
                              {doc.fechaEscaneo.toDate().toLocaleDateString('es-CO')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <ExternalLink
                            size={16}
                            className="text-slate-400 group-hover:text-primary transition-colors"
                          />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <FileText className="text-blue-600 flex-shrink-0" size={20} />
          <div className="text-sm">
            <p className="font-medium text-blue-900">💡 Consejo</p>
            <p className="text-blue-800 mt-1">
              Usa la búsqueda para encontrar documentos rápidamente por número de radicado o expediente.
              Haz clic en cualquier documento para abrirlo en OneDrive.
            </p>
          </div>
        </div>
      </Card>
    </section>
  )
}
