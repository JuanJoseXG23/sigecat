import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ActuationDialog } from '@/features/expedients/components/actuation-dialog'
import { ExpedientDocuments } from '@/features/expedients/components/expedient-documents'
import { ExpedientHistory } from '@/features/expedients/components/expedient-history'
import { ExpedientSummary } from '@/features/expedients/components/expedient-summary'
import { WorkflowStepper } from '@/features/expedients/components/workflow-stepper'
import { useAuth } from '@/hooks/use-auth'
import { useExpedientDetail, useExpedientHistory } from '@/hooks/use-expedient-detail'
import { getFlow } from '@/lib/expedient-workflow'
import { canManageExpedient } from '@/lib/permissions'
import { listExpedientFilings } from '@/services/filing.service'
import { isFinalizedExpedient } from '@/types/expedient'

type Tab = 'Información' | 'Historial' | 'Documentos'
const tabs: Tab[] = ['Información', 'Historial', 'Documentos']

export function ExpedientDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { data: item, isLoading } = useExpedientDetail(id)
  const { data: history = [] } = useExpedientHistory(id)
  const { data: filings = [] } = useQuery({
    queryKey: ['filings', id],
    queryFn: () => listExpedientFilings(id!),
    enabled: Boolean(id),
  })
  const [tab, setTab] = useState<Tab>('Información')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const associatedFilings = useMemo(
    () =>
      Array.from(
        new Map(filings.map((filing) => [`${filing.numero}-${filing.fecha}`, filing])).values(),
      ),
    [filings],
  )

  if (isLoading) return <p className="text-sm text-slate-500">Cargando expediente…</p>
  if (!item) return <p className="text-sm text-slate-500">No se encontró el expediente.</p>
  const finalized = isFinalizedExpedient(item)
  const flow = getFlow(item)
  const currentIndex = flow.indexOf(item.estado)

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/dashboard" className="text-sm text-slate-500">
            ← Volver a la bandeja
          </Link>
          <p className="mt-3 text-sm font-medium text-primary">Expediente {item.numeroRadicado}</p>
          <h1 className="text-2xl font-semibold">Gestión del trámite</h1>
        </div>
        <Badge variant={finalized ? 'success' : 'info'}>
          {finalized ? 'Solo consulta' : item.estado}
        </Badge>
      </div>
      <WorkflowStepper
        flow={flow}
        currentIndex={currentIndex}
        canContinue={!finalized && canManageExpedient(profile, item)}
        onContinue={() => {
          setNotice('')
          setDialogOpen(true)
        }}
      />
      <div className="flex gap-1 border-b" role="tablist" aria-label="Secciones del expediente">
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`border-b-2 px-4 py-3 text-sm ${tab === value ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}
          >
            {value}
          </button>
        ))}
      </div>
      <Card className="p-5">
        {tab === 'Información' && <ExpedientSummary expedient={item} filings={associatedFilings} />}
        {tab === 'Historial' && <ExpedientHistory entries={history} />}
        {tab === 'Documentos' && <ExpedientDocuments documents={item.documentosWorkflow ?? []} />}
      </Card>
      {dialogOpen && (
        <ActuationDialog
          expedient={item}
          onClose={() => setDialogOpen(false)}
          onCompleted={(message) => {
            setDialogOpen(false)
            setNotice(message ?? '')
          }}
        />
      )}
    </section>
  )
}
