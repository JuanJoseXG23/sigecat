import { ChevronDown, ExternalLink, FileText, FolderOpen, Library, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, LoadingState } from '@/components/ui/feedback'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/features/expedients/components/expedient-badges'
import { useDocumentsLibrary } from '@/hooks/use-documents-library'
import { formatDate, normalizeSearch } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DocumentsLibraryPage() {
  const { data: expedients = [], isLoading, isError, refetch } = useDocumentsLibrary()
  const [searchTerm, setSearchTerm] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = normalizeSearch(searchTerm)
    if (!term) return expedients
    const matches = (value?: string) => Boolean(value && normalizeSearch(value).includes(term))
    return expedients
      .map((expedient) => {
        const expedientMatches =
          matches(expedient.numeroRadicado) || matches(expedient.solicitantes[0]?.nombre)
        return {
          ...expedient,
          documentos: expedientMatches
            ? expedient.documentos
            : expedient.documentos.filter(
                (document) =>
                  matches(document.radicado) || matches(document.tipo) || matches(document.nombre),
              ),
        }
      })
      .filter((expedient) => expedient.documentos.length > 0)
  }, [expedients, searchTerm])

  const totalDocuments = filtered.reduce((sum, expedient) => sum + expedient.documentos.length, 0)

  return (
    <section className="mx-auto max-w-[1200px] space-y-6">
      <PageHeader
        kicker="Archivo"
        title="Biblioteca de documentos"
        description="Documentos escaneados en OneDrive, agrupados por expediente."
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por radicado, solicitante, nombre o tipo de documento"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-9"
            aria-label="Buscar documentos"
          />
        </div>
        <p className="shrink-0 px-2 text-sm text-muted-foreground">
          <b className="text-slate-800">{filtered.length}</b> expedientes ·{' '}
          <b className="text-slate-800">{totalDocuments}</b> documentos
        </p>
      </div>

      {isLoading ? (
        <LoadingState label="Cargando documentos…" />
      ) : isError ? (
        <EmptyState
          icon={FileText}
          title="No fue posible cargar los documentos"
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="table-shell">
          <EmptyState
            icon={Library}
            title={searchTerm ? 'Sin resultados' : 'Aún no hay documentos'}
            description={
              searchTerm
                ? 'Prueba con otro número de radicado o nombre.'
                : 'Los documentos aparecen al asociarlos en el flujo de cada expediente.'
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((expedient) => {
            const open = expanded === expedient.id || Boolean(searchTerm)
            return (
              <div key={expedient.id} className="table-shell">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === expedient.id ? null : expedient.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpen size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">
                      Radicado {expedient.numeroRadicado}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {expedient.solicitantes[0]?.nombre ?? 'Sin solicitante'} ·{' '}
                      {expedient.tipoTramite ?? 'Sin tipo'}
                    </span>
                  </span>
                  <span className="hidden items-center gap-2 sm:flex">
                    <Badge variant="default">{expedient.documentos.length} doc.</Badge>
                    <StatusBadge status={expedient.estado} />
                  </span>
                  <ChevronDown
                    size={18}
                    className={cn('shrink-0 text-slate-400 transition', open && 'rotate-180')}
                  />
                </button>

                {open && (
                  <div className="border-t border-border bg-muted/30 p-3">
                    <ul className="space-y-2">
                      {expedient.documentos.map((document) => (
                        <li key={document.id}>
                          <a
                            href={document.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-3 rounded-lg border border-border bg-white p-3 transition hover:border-primary/50"
                          >
                            <FileText size={18} className="shrink-0 text-primary" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-primary">
                                {document.nombre}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {document.tipo}
                                {document.radicado ? ` · Radicado ${document.radicado}` : ''}
                                {document.folios ? ` · ${document.folios} folios` : ''} ·{' '}
                                {formatDate(document.fecha, 'Sin fecha')}
                              </span>
                            </span>
                            <ExternalLink size={15} className="shrink-0 text-slate-400" />
                          </a>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={`/expedientes/${expedient.id}?tab=documentos`}
                      className="link mt-3 inline-flex items-center gap-1.5 px-1 text-sm"
                    >
                      Ver índice y hoja de control del expediente
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
