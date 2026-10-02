import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CalendarPlus, FileSearch, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { EmptyState, LoadingState } from '@/components/ui/feedback'
import { useToast } from '@/components/ui/toast-context'
import { ActuationDialog } from '@/features/expedients/components/actuation-dialog'
import { DeadlineBadge, StatusBadge } from '@/features/expedients/components/expedient-badges'
import { ExpedientDocuments } from '@/features/expedients/components/expedient-documents'
import { ExpedientHistory } from '@/features/expedients/components/expedient-history'
import { ExpedientSummary } from '@/features/expedients/components/expedient-summary'
import { ExtensionDialog } from '@/features/expedients/components/extension-dialog'
import { WorkflowStepper } from '@/features/expedients/components/workflow-stepper'
import { useAuth } from '@/hooks/use-auth'
import { useExpedientDetail, useExpedientHistory } from '@/hooks/use-expedient-detail'
import { getFlow, getStepDefinition, type Actuation } from '@/lib/expedient-workflow'
import { formatDate, formatLongDate } from '@/lib/format'
import { canManageExpedient } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { listExpedientFilings } from '@/services/filing.service'
import { getClosingDate, isFinalizedExpedient } from '@/types/expedient'

const tabs = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'historial', label: 'Historial' },
] as const
type Tab = (typeof tabs)[number]['id']

function describeActuation(actuation: Actuation): { title: string; description?: string } {
  if (actuation.kind === 'assign')
    return {
      title: `Expediente ${actuation.advanceTo ? 'asignado' : 'reasignado'} a ${actuation.assignee.nombreCompleto}`,
      description: 'El correo de notificación llegará en máximo cinco minutos.',
    }
  if (actuation.kind === 'transfer')
    return {
      title: `Trasladado a ${actuation.destination}`,
      description: 'Genera el radicado de traslado.',
    }
  return actuation.nextStatus === 'Archivo (Finalizado)'
    ? { title: 'Expediente finalizado', description: 'Quedó en el Histórico para consulta.' }
    : { title: actuation.action, description: `Siguiente paso: ${actuation.nextStatus}.` }
}

export function ExpedientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { profile } = useAuth()
  const { data: item, isLoading } = useExpedientDetail(id)
  const { data: history = [] } = useExpedientHistory(id)
  const { data: filings = [] } = useQuery({
    queryKey: ['filings', id],
    queryFn: () => listExpedientFilings(id!),
    enabled: Boolean(id),
  })
  const [dialog, setDialog] = useState<'actuation' | 'extension' | null>(null)
  const associatedFilings = useMemo(
    () =>
      Array.from(
        new Map(filings.map((filing) => [`${filing.numero}-${filing.fecha}`, filing])).values(),
      ),
    [filings],
  )
  const tabParam = params.get('tab')
  const tab: Tab = tabs.some((entry) => entry.id === tabParam) ? (tabParam as Tab) : 'resumen'

  if (isLoading) return <LoadingState label="Cargando expediente…" />
  if (!item)
    return (
      <EmptyState
        icon={FileSearch}
        title="No encontramos este expediente"
        description="Puede que el enlace esté incompleto o que el expediente no exista."
        action={
          <Link to="/expedientes" className={buttonVariants({ variant: 'outline' })}>
            Ir a expedientes
          </Link>
        }
      />
    )

  const finalized = isFinalizedExpedient(item)
  const canManage = !finalized && canManageExpedient(profile, item)
  const flow = getFlow(item)
  const currentIndex = flow.indexOf(item.estado)
  const step = getStepDefinition(item.estado)
  const canExtend = canManage && Boolean(item.fechaLimite) && (item.diasRestantes ?? 0) >= 0
  const counts: Record<Tab, number | undefined> = {
    resumen: undefined,
    documentos: item.documentosWorkflow?.length ?? 0,
    historial: history.length,
  }
  const restricted = item.nivelAcceso && item.nivelAcceso !== 'Pública'

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))

  return (
    <section className="mx-auto max-w-[1400px] space-y-5">
      <button
        type="button"
        onClick={goBack}
        className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flag-stripe h-1" aria-hidden="true" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.estado} />
              {!finalized && <DeadlineBadge status={item.estadoTermino} />}
              {Boolean(item.diasAmpliacion) && (
                <Badge variant="info">Plazo ampliado +{item.diasAmpliacion}</Badge>
              )}
              {restricted && (
                <Badge variant="default">
                  <Lock size={12} /> {item.nivelAcceso}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Radicado {item.numeroRadicado}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[item.tipoTramite, item.asunto, item.solicitantes[0]?.nombre]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-3 lg:items-end">
            {finalized ? (
              <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">Expediente cerrado · solo consulta</p>
                <p className="text-muted-foreground">Cierre: {formatDate(getClosingDate(item))}</p>
              </div>
            ) : (
              <>
                {item.fechaLimite && (
                  <p className="text-sm text-muted-foreground lg:text-right">
                    Vence el <b className="text-slate-900">{formatLongDate(item.fechaLimite)}</b>
                  </p>
                )}
                {canManage ? (
                  <div className="no-print flex flex-wrap gap-2">
                    {canExtend && (
                      <Button variant="outline" onClick={() => setDialog('extension')}>
                        <CalendarPlus size={17} /> Ampliar plazo
                      </Button>
                    )}
                    <Button onClick={() => setDialog('actuation')}>
                      {step.title === 'Completar actuación'
                        ? `Completar: ${item.estado}`
                        : step.title}
                      <ArrowRight size={17} />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Gestiona: {item.funcionarioAsignado?.nombreCompleto ?? 'sin responsable'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="border-t border-border bg-muted/30 px-5 py-5 sm:px-6">
          <WorkflowStepper flow={flow} currentIndex={currentIndex} />
        </div>
      </div>

      <div
        className="no-print flex gap-1 overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Secciones del expediente"
      >
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setParams({ tab: entry.id }, { replace: true })}
            className={cn(
              '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition',
              tab === entry.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-slate-900',
            )}
          >
            {entry.label}
            {counts[entry.id] !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  tab === entry.id ? 'bg-primary/10' : 'bg-muted',
                )}
              >
                {counts[entry.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'resumen' && <ExpedientSummary expedient={item} filings={associatedFilings} />}
        {tab === 'documentos' && <ExpedientDocuments expedient={item} />}
        {tab === 'historial' && <ExpedientHistory entries={history} />}
      </div>

      {dialog === 'actuation' && (
        <ActuationDialog
          expedient={item}
          onClose={() => setDialog(null)}
          onCompleted={(actuation) => {
            setDialog(null)
            toast(describeActuation(actuation))
          }}
        />
      )}
      {dialog === 'extension' && (
        <ExtensionDialog
          expedient={item}
          onClose={() => setDialog(null)}
          onCompleted={(newDeadline) => {
            setDialog(null)
            toast({
              title: 'Plazo ampliado',
              description: `Nueva fecha límite: ${formatLongDate(newDeadline)}.`,
            })
          }}
        />
      )}
    </section>
  )
}
