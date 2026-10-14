import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  FileSearch,
  Handshake,
  History,
  MessageCircleQuestion,
  Pencil,
  StickyNote,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { ActionMenu } from '@/components/ui/action-menu'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Alert, EmptyState, LoadingState } from '@/components/ui/feedback'
import { useToast } from '@/components/ui/toast-context'
import { ActuationDialog } from '@/features/expedients/components/actuation-dialog'
import {
  EditDocumentDialog,
  EditExpedientDialog,
  EditFilingDialog,
} from '@/features/expedients/components/correction-dialogs'
import { DeadlineBadge, StatusBadge } from '@/features/expedients/components/expedient-badges'
import { ExpedientDocuments } from '@/features/expedients/components/expedient-documents'
import { ExpedientHistory } from '@/features/expedients/components/expedient-history'
import { ExpedientSummary } from '@/features/expedients/components/expedient-summary'
import { ExtensionDialog } from '@/features/expedients/components/extension-dialog'
import { SupportDialog } from '@/features/expedients/components/support-dialog'
import { NoteDialog } from '@/features/expedients/components/note-dialog'
import { InquiryDialog } from '@/features/expedients/components/inquiry-dialog'
import { LateRegistrationDialog } from '@/features/expedients/components/late-registration-dialog'
import { WorkflowStepper } from '@/features/expedients/components/workflow-stepper'
import { useAuth } from '@/hooks/use-auth'
import { useExpedientDetail, useExpedientHistory } from '@/hooks/use-expedient-detail'
import { getDependencyName, getExpedientDependency } from '@/lib/dependencies'
import { hasReplacedEntryFiling, suggestEntryFiling } from '@/lib/entry-filing'
import { canAddNote } from '@/lib/expedient-notes'
import { getFlow, getStepDefinition, type Actuation } from '@/lib/expedient-workflow'
import { describeRemainingDays, formatDate, formatLongDate } from '@/lib/format'
import { getLateRegistrationScope, type LateRegistrationPlan } from '@/lib/late-registration'
import { canAskAboutExpedients, canCorrectRecords, canManageExpedient } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { listExpedientFilings, type FilingRecord } from '@/services/filing.service'
import { getClosingDate, isFinalizedExpedient, type WorkflowDocument } from '@/types/expedient'

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

function describeLateRegistration(plan: LateRegistrationPlan): {
  title: string
  description: string
} {
  if (!plan.finalized)
    return { title: 'Expediente al día', description: `Paso actual: ${plan.finalStatus}.` }
  return plan.timeliness?.onTime
    ? {
        title: 'Expediente finalizado dentro del término',
        description: 'Se tomó la fecha real de la respuesta. Quedó en el Histórico.',
      }
    : {
        title: 'Expediente finalizado fuera del término',
        description: `La respuesta se radicó ${plan.timeliness?.businessDaysLate} días hábiles después del vencimiento.`,
      }
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
  const [dialog, setDialog] = useState<
    'actuation' | 'extension' | 'edit' | 'late' | 'inquiry' | 'support' | 'note' | null
  >(params.get('registro') === 'tardio' ? 'late' : null)
  const [editingFiling, setEditingFiling] = useState<FilingRecord | null>(null)
  const [editingDocument, setEditingDocument] = useState<WorkflowDocument | null>(null)
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
        description="Puede que el enlace esté incompleto, que el expediente no exista o que no haya pasado por ti: cada funcionario ve los expedientes que registró, tiene o tuvo asignados."
        action={
          <Link to="/expedientes" className={buttonVariants({ variant: 'outline' })}>
            Ir a expedientes
          </Link>
        }
      />
    )

  const finalized = isFinalizedExpedient(item)
  const canManage = !finalized && canManageExpedient(profile, item)
  const canEditData = canManageExpedient(profile, item)
  const canCorrect = canCorrectRecords(profile)
  const flow = getFlow(item)
  const currentIndex = flow.indexOf(item.estado)
  const step = getStepDefinition(item.estado)
  const canExtend = canManage && Boolean(item.fechaLimite) && (item.diasRestantes ?? 0) >= 0
  const canRegisterLate =
    canManage && Boolean(item.fechaLimite) && Boolean(getLateRegistrationScope(item.estado))
  const canNote = canAddNote(profile, item)
  const canAsk = !finalized && canAskAboutExpedients(profile) && Boolean(item.funcionarioAsignado)
  const entryFilingReplaced = hasReplacedEntryFiling(item)
  const suggestedEntryFiling = entryFilingReplaced ? suggestEntryFiling(item) : undefined
  const counts: Record<Tab, number | undefined> = {
    resumen: undefined,
    documentos: item.documentosWorkflow?.length ?? 0,
    historial: history.length,
  }

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  return (
    <section className="mx-auto max-w-[1400px] space-y-5">
      <button
        type="button"
        onClick={goBack}
        className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} /> Volver
      </button>

      {/* Sin overflow-hidden: el menú Más acciones debe poder salir de la tarjeta. */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flag-stripe h-1 rounded-t-2xl" aria-hidden="true" />
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.estado} />
                {!finalized && <DeadlineBadge status={item.estadoTermino} />}
                {Boolean(item.diasAmpliacion) && (
                  <Badge variant="info">Plazo ampliado +{item.diasAmpliacion}</Badge>
                )}
              </div>
              <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Radicado {item.numeroRadicado}
              </h1>
              <p className="text-sm text-muted-foreground">
                {[
                  getDependencyName(getExpedientDependency(item)),
                  item.tipoTramite,
                  item.asunto,
                  item.solicitantes[0]?.nombre,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            {finalized ? (
              <div className="shrink-0 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">
                  Expediente cerrado · {canEditData ? 'corrección habilitada' : 'solo consulta'}
                </p>
                <p className="text-muted-foreground">Cierre: {formatDate(getClosingDate(item))}</p>
              </div>
            ) : (
              <div className="shrink-0 space-y-1 text-sm text-muted-foreground sm:text-right">
                {item.fechaLimite && (
                  <p>
                    Vence el <b className="text-slate-900">{formatLongDate(item.fechaLimite)}</b>
                  </p>
                )}
                <p>
                  Gestiona:{' '}
                  <span className="font-medium text-slate-900">
                    {item.funcionarioAsignado?.nombreCompleto ?? 'sin responsable'}
                  </span>
                </p>
              </div>
            )}
          </div>

          {(canManage || (finalized && canEditData) || canAsk || canNote) && (
            <div className="no-print flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {canManage && (
                <Button onClick={() => setDialog('actuation')}>
                  {step.title === 'Completar actuación' ? `Completar: ${item.estado}` : step.title}
                  <ArrowRight size={17} />
                </Button>
              )}
              {(canManage || (finalized && canEditData)) && (
                <Button variant="outline" onClick={() => setDialog('edit')}>
                  <Pencil size={16} /> Editar datos
                </Button>
              )}
              <ActionMenu
                label="Más acciones"
                actions={[
                  ...(canExtend
                    ? [
                        {
                          label: 'Ampliar plazo',
                          description: 'Radicar la ampliación del término antes del vencimiento.',
                          icon: CalendarPlus,
                          onSelect: () => setDialog('extension'),
                        },
                      ]
                    : []),
                  ...(canManage
                    ? [
                        {
                          label: 'Apoyo en respuesta',
                          description: 'Otra área o persona respondió parte de la petición.',
                          icon: Handshake,
                          onSelect: () => setDialog('support'),
                        },
                      ]
                    : []),
                  ...(canRegisterLate
                    ? [
                        {
                          label: 'Registrar atrasado',
                          description:
                            'Subir respuestas, traslados o ampliaciones ya radicados, con sus fechas reales.',
                          icon: History,
                          onSelect: () => setDialog('late'),
                        },
                      ]
                    : []),
                  ...(canNote
                    ? [
                        {
                          label: 'Agregar nota',
                          description: 'Aclarar algo en el historial, sin cambiar el expediente.',
                          icon: StickyNote,
                          onSelect: () => setDialog('note'),
                        },
                      ]
                    : []),
                ]}
              />
              {canAsk && (
                <Button variant="outline" className="ml-auto" onClick={() => setDialog('inquiry')}>
                  <MessageCircleQuestion size={17} /> Preguntar al responsable
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="rounded-b-2xl border-t border-border bg-muted/30 px-5 py-5 sm:px-6">
          <WorkflowStepper flow={flow} currentIndex={currentIndex} />
        </div>
      </div>

      {canRegisterLate && item.estadoTermino === 'Vencido' && (
        <Alert
          tone="warning"
          title={`Aparece vencido: ${describeRemainingDays(item.diasRestantes).toLocaleLowerCase('es-CO')}`}
          className="no-print"
        >
          <p>
            Si ya se respondió, se trasladó o se amplió el plazo a tiempo y no se subió a la
            aplicación, regístralo con las fechas reales: el término se calculará con ellas.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setDialog('late')}>
            <History size={15} /> Registrar actuaciones atrasadas
          </Button>
        </Alert>
      )}

      {entryFilingReplaced && (
        <Alert tone="warning" title="El radicado de entrada fue reemplazado" className="no-print">
          <p>
            {item.numeroRadicado} es un radicado de respuesta, traslado o ampliación de este
            expediente.{' '}
            {suggestedEntryFiling
              ? `El radicado de entrada parece ser ${suggestedEntryFiling} (documento recibido).`
              : 'Revisa el documento recibido para encontrar el radicado de entrada.'}
          </p>
          {canCorrect ? (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setDialog('edit')}>
              <Pencil size={15} /> Corregir radicado de entrada
            </Button>
          ) : (
            <p>Pide a Administración o Coordinación que lo corrijan.</p>
          )}
        </Alert>
      )}

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
        {tab === 'resumen' && (
          <ExpedientSummary
            expedient={item}
            filings={associatedFilings}
            onEditFiling={canCorrect ? setEditingFiling : undefined}
          />
        )}
        {tab === 'documentos' && (
          <ExpedientDocuments
            expedient={item}
            onEditDocument={canCorrect ? setEditingDocument : undefined}
          />
        )}
        {tab === 'historial' && (
          <ExpedientHistory
            entries={history}
            filingNumber={item.numeroRadicado}
            onAddNote={canNote ? () => setDialog('note') : undefined}
          />
        )}
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
      {dialog === 'inquiry' && <InquiryDialog expedient={item} onClose={() => setDialog(null)} />}
      {dialog === 'late' && (
        <LateRegistrationDialog
          expedient={item}
          onClose={() => setDialog(null)}
          onCompleted={(plan) => {
            setDialog(null)
            toast(describeLateRegistration(plan))
          }}
        />
      )}
      {dialog === 'edit' && (
        <EditExpedientDialog expedient={item} onClose={() => setDialog(null)} />
      )}
      {editingFiling && (
        <EditFilingDialog filing={editingFiling} onClose={() => setEditingFiling(null)} />
      )}
      {editingDocument && (
        <EditDocumentDialog
          expedientId={item.id}
          document={editingDocument}
          onClose={() => setEditingDocument(null)}
        />
      )}
      {dialog === 'support' && (
        <SupportDialog
          expedient={item}
          onClose={() => setDialog(null)}
          onCompleted={() => {
            setDialog(null)
            toast({
              title: 'Apoyo registrado',
              description: 'Quedó en el resumen y en el historial.',
            })
          }}
        />
      )}
      {dialog === 'note' && (
        <NoteDialog
          expedient={item}
          onClose={() => setDialog(null)}
          onCompleted={() => {
            setDialog(null)
            setParams({ tab: 'historial' }, { replace: true })
            toast({ title: 'Nota agregada', description: 'Quedó en el historial.' })
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
