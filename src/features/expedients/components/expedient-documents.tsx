import { ExternalLink, FileText, Printer } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { formatDate, formatDateTime } from '@/lib/format'
import {
  getClosingDate,
  isFinalizedExpedient,
  WORKFLOW_DOCUMENT_LABELS,
  type Expedient,
  type WorkflowDocument,
  type WorkflowDocumentType,
} from '@/types/expedient'
import shield from '@/img/Escudo_de_Girardota.webp'

const typeVariants: Record<WorkflowDocumentType, BadgeVariant> = {
  RECIBIDO: 'info',
  RADICADO_SALIDA: 'success',
  TRASLADO: 'violet',
  AMPLIACION_PLAZO: 'warning',
}

interface IndexedDocument extends WorkflowDocument {
  order: number
  folioRange: string
}

/**
 * Índice del expediente en orden cronológico, con foliación consecutiva cuando se conocen los
 * folios de cada documento (principio de orden original).
 */
function buildIndex(documents: WorkflowDocument[]): { items: IndexedDocument[]; folios: number } {
  let folio = 0
  let complete = true
  const items = [...documents]
    .sort((first, second) => first.fecha.toMillis() - second.fecha.toMillis())
    .map((document, index) => {
      let folioRange = '—'
      if (document.folios && complete) {
        folioRange =
          document.folios === 1 ? `${folio + 1}` : `${folio + 1} a ${folio + document.folios}`
        folio += document.folios
      } else complete = false
      return { ...document, order: index + 1, folioRange }
    })
  return { items, folios: folio }
}

function printControlSheet() {
  document.body.classList.add('print-only-sheet')
  const cleanup = () => {
    document.body.classList.remove('print-only-sheet')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}

/** Hoja de control del expediente (Acuerdo 002 de 2014, AGN); solo aparece al imprimir. */
function ControlSheet({
  expedient,
  index,
}: {
  expedient: Expedient
  index: ReturnType<typeof buildIndex>
}) {
  const classification = expedient.clasificacionDocumental
  const closed = isFinalizedExpedient(expedient)
  const cell = 'border border-slate-400 px-2 py-1 align-top'
  return (
    <div className="print-sheet hidden text-[11px] leading-snug text-black print:block">
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={cell} rowSpan={2} style={{ width: 70 }}>
              <img src={shield} alt="" style={{ width: 54 }} />
            </td>
            <td className={`${cell} text-center text-sm font-bold`}>MUNICIPIO DE GIRARDOTA</td>
            <td className={cell} style={{ width: 150 }}>
              Fecha de impresión: {formatDate(new Date())}
            </td>
          </tr>
          <tr>
            <td className={`${cell} text-center font-bold`}>HOJA DE CONTROL DEL EXPEDIENTE</td>
            <td className={cell}>Página 1</td>
          </tr>
        </tbody>
      </table>
      <table className="mt-3 w-full border-collapse">
        <tbody>
          <tr>
            <td className={`${cell} font-semibold`}>Unidad administrativa</td>
            <td className={cell}>Secretaría de Hacienda · Catastro</td>
            <td className={`${cell} font-semibold`}>Código TRD</td>
            <td className={cell}>{classification?.codigo ?? ''}</td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>Serie / subserie</td>
            <td className={cell} colSpan={3}>
              {classification?.serie ?? ''}
              {classification?.subserie ? ` / ${classification.subserie}` : ''}
            </td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>Expediente</td>
            <td className={cell} colSpan={3}>
              Radicado {expedient.numeroRadicado} · {expedient.tipoTramite ?? ''}
              {expedient.asunto ? ` · ${expedient.asunto}` : ''} ·{' '}
              {expedient.solicitantes
                .map((applicant) => applicant.nombre)
                .filter(Boolean)
                .join(', ')}
            </td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>Fecha de apertura</td>
            <td className={cell}>{formatDate(expedient.fechaRadicado)}</td>
            <td className={`${cell} font-semibold`}>Fecha de cierre</td>
            <td className={cell}>{closed ? formatDate(getClosingDate(expedient)) : 'Abierto'}</td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>Nivel de acceso</td>
            <td className={cell}>{expedient.nivelAcceso ?? ''}</td>
            <td className={`${cell} font-semibold`}>Total de folios</td>
            <td className={cell}>{index.folios || ''}</td>
          </tr>
        </tbody>
      </table>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            {[
              'N.º',
              'Fecha',
              'Tipo documental',
              'Descripción',
              'Radicado',
              'Folios',
              'Registró',
            ].map((header) => (
              <th key={header} className={`${cell} text-left`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {index.items.map((document) => (
            <tr key={document.id}>
              <td className={cell}>{document.order}</td>
              <td className={cell}>{formatDate(document.fecha)}</td>
              <td className={cell}>{WORKFLOW_DOCUMENT_LABELS[document.tipo] ?? document.tipo}</td>
              <td className={cell}>{document.nombre}</td>
              <td className={cell}>{document.radicadoNumero ?? ''}</td>
              <td className={cell}>{document.folioRange}</td>
              <td className={cell}>{document.usuario}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-10 grid grid-cols-2 gap-10">
        {['Elaboró', 'Revisó'].map((label) => (
          <div key={label} className="border-t border-black pt-1">
            {label}: nombre, cargo y firma
          </div>
        ))}
      </div>
    </div>
  )
}

export function ExpedientDocuments({ expedient }: { expedient: Expedient }) {
  const index = buildIndex(expedient.documentosWorkflow ?? [])

  if (!index.items.length)
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <EmptyState
          icon={FileText}
          title="Sin documentos asociados"
          description="Los documentos se asocian desde OneDrive al avanzar cada paso del flujo."
        />
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Índice documental en orden cronológico
          {index.folios ? ` · ${index.folios} folios` : ''}.
        </p>
        <Button variant="outline" size="sm" onClick={printControlSheet}>
          <Printer size={16} /> Imprimir hoja de control
        </Button>
      </div>
      <div className="table-shell overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th className="w-12">N.º</th>
              <th>Documento</th>
              <th>Radicado</th>
              <th>Folios</th>
              <th>Asociado</th>
              <th>
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {index.items.map((document) => (
              <tr key={document.id}>
                <td className="tabular-nums text-muted-foreground">{document.order}</td>
                <td>
                  <p className="font-medium text-slate-900">{document.nombre}</p>
                  <Badge variant={typeVariants[document.tipo] ?? 'default'} className="mt-1">
                    {WORKFLOW_DOCUMENT_LABELS[document.tipo] ?? document.tipo}
                  </Badge>
                </td>
                <td>
                  {document.radicadoNumero ? (
                    <>
                      <p className="font-medium">{document.radicadoNumero}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(document.radicadoFecha)}
                      </p>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="tabular-nums">{document.folioRange}</td>
                <td>
                  <p>{document.usuario}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(document.fecha)}</p>
                </td>
                <td className="text-right">
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link inline-flex items-center gap-1"
                  >
                    Abrir <ExternalLink size={14} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ControlSheet expedient={expedient} index={index} />
    </div>
  )
}
