import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { OneDriveDocumentSelector } from '@/components/one-drive-document-selector'
import { TimeElapsedButton } from '@/components/time-elapsed-button'
import { useAuth } from '@/hooks/use-auth'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useExpedientDetail, useExpedientHistory } from '@/hooks/use-expedient-detail'
import { useAddExpedientWorkflowDocument } from '@/hooks/use-expedient-workflow-documents'
import {
  completeRequiredActuation,
  deleteExpedient,
  transferByCompetence,
  updateExpedientAssignee,
  updateExternalAssignee,
} from '@/services/expedient.service'
import {
  isFinalizedExpedient,
  STANDARD_FLOW,
  TRANSFER_FLOW,
  type ExpedientStatus,
} from '@/types/expedient'

type Tab = 'Información' | 'Historial' | 'Documentos'
const tabs: Tab[] = ['Información', 'Historial', 'Documentos']
function requiresFiling(status: ExpedientStatus) {
  return ['Radicado de salida', 'Generar radicado de traslado', 'Radicar respuesta'].includes(
    status,
  )
}

function getWorkflowDocumentRequirement(status: ExpedientStatus) {
  if (status === 'Recibido') {
    return {
      required: true,
      documentType: 'RECIBIDO' as const,
      title: 'Se requiere escanear el documento recibido y asociarlo en OneDrive.',
      description: 'Este documento será obligatorio antes de continuar con el trámite.',
    }
  }
  if (status === 'Radicado de salida') {
    return {
      required: true,
      documentType: 'RADICADO_SALIDA' as const,
      title: 'Se requiere escanear la respuesta radicada en OneDrive.',
      description: 'Antes de finalizar, asocia el documento de respuesta radicada.',
    }
  }
  if (status === 'Generar radicado de traslado') {
    return {
      required: true,
      documentType: 'TRASLADO' as const,
      title: 'Se requiere escanear el documento del traslado realizado.',
      description: 'Asocia el documento de traslado en OneDrive antes de continuar.',
    }
  }
  return null
}

export function ExpedientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const { data: item, isLoading } = useExpedientDetail(id)
  const { data: history = [] } = useExpedientHistory(id)
  const { data: officials = [] } = useAssignableOfficials()
  const workflowDocuments = item?.documentosWorkflow ?? []
  const addWorkflowDocument = useAddExpedientWorkflowDocument()
  const [tab, setTab] = useState<Tab>('Información')
  const [dialog, setDialog] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [signed, setSigned] = useState(false)
  const [choice, setChoice] = useState<'response' | 'transfer' | 'change'>('response')
  const [responsible, setResponsible] = useState('')
  const [other, setOther] = useState('')
  const [destination, setDestination] = useState('')
  const [reason, setReason] = useState('')
  const [number, setNumber] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  void setOther
  const refresh = () =>
    Promise.all(
      [
        'expedient',
        'expedient-history',
        'expedients',
        'work-tray',
        'historical-expedients',
        'filings',
      ].map((key) => client.invalidateQueries({ queryKey: [key] })),
    )
  const execute = useMutation({
    mutationFn: async () => {
      if (!item || !user) return
      const flow = item.trasladoPorCompetencia ? TRANSFER_FLOW : STANDARD_FLOW
      const index = flow.indexOf(item.estado)
      const next = flow[index + 1]
      if (item.estado === 'Recibido')
        return completeRequiredActuation(
          item.id,
          user.uid,
          'Confirmó firma del formato físico',
          notes || 'Formato físico firmado.',
          'Asignado',
          { formatoFisicoFirmado: true },
        )
      if (item.estado === 'Asignado') {
        const selected = officials.find((entry) => entry.uid === responsible)
        if (selected)
          await updateExpedientAssignee(
            item.id,
            { uid: selected.uid, nombreCompleto: selected.nombreCompleto },
            user.uid,
          )
        else await updateExternalAssignee(item.id, other, user.uid)
        return completeRequiredActuation(
          item.id,
          user.uid,
          'Asignó responsable',
          selected?.nombreCompleto ?? other,
          'En respuesta',
        )
      }
      if (item.estado === 'En respuesta') {
        if (choice === 'change') {
          const selected = officials.find((entry) => entry.uid === responsible)
          if (selected)
            return updateExpedientAssignee(
              item.id,
              { uid: selected.uid, nombreCompleto: selected.nombreCompleto },
              user.uid,
            )
          return updateExternalAssignee(item.id, other, user.uid)
        }
        if (choice === 'transfer') return transferByCompetence(item.id, destination, user.uid)
        return completeRequiredActuation(
          item.id,
          user.uid,
          'Seleccionó respuesta a usuario',
          notes || 'Se inició la respuesta al ciudadano.',
          'Radicado de salida',
        )
      }
      if (!next) return
      return completeRequiredActuation(
        item.id,
        user.uid,
        requiresFiling(item.estado) ? 'Registró radicado' : 'Generó actuación del trámite',
        number ? `Radicado ${number}. ${notes}` : notes || 'Actuación completada.',
        next,
        number ? { numeroRadicado: number, fechaRadicadoActuacion: date } : {},
      )
    },
    onSuccess: async () => {
      setDialog(false)
      setSigned(false)
      setNumber('')
      setNotes('')
      await refresh()
    },
  })
  const deleteExpedientMutation = useMutation({
    mutationFn: async () => {
      if (!item || !user) return
      return deleteExpedient(item.id)
    },
    onSuccess: async () => {
      setDeleteDialogOpen(false)
      await refresh()
      navigate('/dashboard')
    },
  })
  if (isLoading) return <p className="text-sm text-slate-500">Cargando expediente…</p>
  if (!item) return <p className="text-sm text-slate-500">No se encontró el expediente.</p>
  const finalized = isFinalizedExpedient(item)
  const flow = item.trasladoPorCompetencia ? TRANSFER_FLOW : STANDARD_FLOW
  const current = Math.max(0, flow.indexOf(item.estado))
  const currentStatus = flow[current]
  const workflowRequirement = getWorkflowDocumentRequirement(currentStatus)
  const hasRequiredWorkflowDocument =
    !workflowRequirement || workflowDocuments.some((document) => document.tipo === workflowRequirement.documentType)
  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <Link to="/dashboard" className="text-sm text-slate-500">
            ← Volver a la bandeja
          </Link>
          <p className="mt-3 text-sm font-medium text-primary">Expediente {item.numeroRadicado}</p>
          <h1 className="text-2xl font-semibold">Gestión del trámite</h1>
        </div>
        <div className="flex gap-2 items-start">
          <Badge variant={finalized ? 'success' : 'info'}>
            {finalized ? 'Solo consulta' : item.estado}
          </Badge>
          {profile?.rol === 'Administrador' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteExpedientMutation.isPending}
              className="gap-2 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={16} />
              Eliminar
            </Button>
          )}
        </div>
      </div>
      <Card className="overflow-x-auto p-4">
        <div className="flex min-w-[700px] gap-2">
          {flow.map((value, index) => (
            <div key={value} className="flex flex-1 items-center gap-2">
              <div
                className={`w-full rounded-lg border p-3 ${index === current ? 'border-primary bg-primary text-primary-foreground' : index < current ? 'border-emerald-200 bg-emerald-50' : 'bg-white'}`}
              >
                <span className="block text-xs">
                  {index < current ? <Check size={14} /> : index + 1}
                </span>
                <b className="text-sm">{value}</b>
                {index === current && !finalized && (
                  <Button
                    className="mt-2 w-full"
                    size="sm"
                    variant="outline"
                    onClick={() => setDialog(true)}
                  >
                    Continuar
                  </Button>
                )}
              </div>
              {index < flow.length - 1 && <span>→</span>}
            </div>
          ))}
        </div>
      </Card>
      <div className="flex gap-1 border-b">
        {tabs.map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`border-b-2 px-4 py-3 text-sm ${tab === value ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}
          >
            {value}
          </button>
        ))}
      </div>
      <Card className="p-5">
        {tab === 'Información' && (
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Radicación</p>
                <p className="mt-2 font-semibold">{item.numeroRadicado}</p>
                <p className="mt-1 text-sm text-slate-600">{item.fechaRadicado.toDate().toLocaleDateString('es-CO')}</p>
                <p className="text-sm text-slate-600">Recibido: {item.fechaRecibido?.toDate().toLocaleDateString('es-CO') ?? 'No registrado'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Trámite y término</p>
                <p className="mt-2 font-semibold">{item.tipoTramite ?? 'Sin tipo'}</p>
                <p className="text-sm text-slate-600">Límite: {item.fechaLimite?.toDate().toLocaleDateString('es-CO') ?? 'No calculada'}</p>
                <div className="mt-3">
                  {item.fechaRadicado && item.fechaLimite && (
                    <TimeElapsedButton
                      diasTranscurridos={Math.floor((new Date().getTime() - item.fechaRadicado.toDate().getTime()) / (1000 * 60 * 60 * 24))}
                      diasRestantes={item.diasRestantes}
                    />
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gestión</p>
                <p className="mt-2 font-semibold">{item.funcionarioAsignado?.nombreCompleto ?? item.responsableExterno ?? 'Sin asignar'}</p>
                <p className="text-sm text-slate-600">Prioridad: {item.prioridad ?? 'Sin prioridad'}</p>
                <p className="text-sm text-slate-600">Ingreso: {item.medioIngreso ?? 'No registrado'}</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div><h2 className="font-semibold">Solicitantes</h2><div className="mt-3 space-y-2">{item.solicitantes.map((applicant, index) => <div key={`${applicant.documento}-${index}`} className="rounded-md border p-3 text-sm"><b>{applicant.nombre ?? 'Sin nombre'}</b><p>{applicant.documento ?? 'Sin documento'} · {applicant.telefono ?? 'Sin teléfono'}</p><p className="text-slate-500">{applicant.correo ?? 'Sin correo'} · {applicant.tipoSolicitante ?? 'Sin tipo'}</p></div>)}</div></div>
              <div><h2 className="font-semibold">Predios</h2><div className="mt-3 space-y-2">{item.predios.map((property, index) => <div key={`${property.numeroPredial}-${index}`} className="rounded-md border p-3 text-sm"><b>{property.municipio ?? 'Sin municipio'}</b><p>{property.direccion ?? 'Sin dirección'}</p><p className="text-slate-500">Predial: {property.numeroPredial ?? '—'} · Matrícula: {property.matriculaInmobiliaria ?? '—'}</p></div>)}</div></div>
            </div>
            <div><h2 className="font-semibold">Observaciones iniciales</h2><p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">{item.observacionesIniciales ?? 'Sin observaciones iniciales.'}</p></div>
          </div>
        )}
        {tab === 'Historial' &&
          history.map((entry) => (
            <article key={entry.id} className="mb-4 border-l-2 border-primary/30 pl-4">
              <b className="text-sm">{entry.accion}</b>
              <p className="text-sm">{entry.detalle}</p>
              <small>{entry.fecha?.toDate().toLocaleString('es-CO')}</small>
            </article>
          ))}
        {tab === 'Documentos' && (
          <div className="space-y-4">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <h3 className="font-semibold mb-3 text-blue-900">📁 Carpeta de OneDrive del expediente</h3>
              <p className="text-sm text-blue-800 mb-3">
                Usa este enlace para abrir la carpeta de OneDrive donde se almacenan los documentos escaneados del expediente.
              </p>
              {item.carpetaOneDrive ? (
                <a
                  href={item.carpetaOneDrive}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <Button variant="default" size="sm">
                    Abrir OneDrive →
                  </Button>
                </a>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                  No hay carpeta documental registrada para este expediente.
                </div>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Documentos asociados</h3>
              {workflowDocuments.length > 0 ? (
                <div className="space-y-3">
                  {workflowDocuments.map((document) => (
                    <div key={document.id} className="rounded-xl border p-4 bg-white shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">{document.nombre}</p>
                          <p className="text-xs text-slate-500">{document.tipo.replace('_', ' ')}</p>
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
          </div>
        )}
      </Card>
      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold">
              {currentStatus === 'Recibido'
                ? 'Confirmación de recepción'
                : currentStatus === 'Asignado'
                  ? 'Asignar expediente'
                  : currentStatus === 'En respuesta'
                    ? 'Definir actuación'
                    : 'Completar actuación'}
            </h2>
            {currentStatus === 'Recibido' && (
              <label className="mt-4 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={signed}
                  onChange={(event) => setSigned(event.target.checked)}
                />{' '}
                Confirmo que el formato físico fue firmado.
              </label>
            )}
            {currentStatus === 'Asignado' && (
              <Select
                className="mt-4"
                value={responsible}
                onChange={(event) => setResponsible(event.target.value)}
              >
                <option value="">Selecciona responsable de Catastro</option>
                {officials.map((entry) => (
                  <option key={entry.uid} value={entry.uid}>
                    {entry.nombreCompleto}
                  </option>
                ))}
              </Select>
            )}
            {currentStatus === 'En respuesta' && (
              <div className="mt-4 space-y-2">
                <Select
                  value={choice}
                  onChange={(event) => setChoice(event.target.value as typeof choice)}
                >
                  <option value="response">Respuesta a usuario</option>
                  <option value="transfer">Traslado por competencia</option>
                  <option value="change">Cambio de responsable</option>
                </Select>
                {choice === 'transfer' && (
                  <>
                    <Input
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                      placeholder="Dependencia destino *"
                    />
                    <Textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Motivo del traslado *"
                    />
                  </>
                )}
                {choice === 'change' && (
                  <Select
                    value={responsible}
                    onChange={(event) => setResponsible(event.target.value)}
                  >
                    <option value="">Selecciona responsable</option>
                    {officials.map((entry) => (
                      <option key={entry.uid} value={entry.uid}>
                        {entry.nombreCompleto}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}
            {workflowRequirement?.required && currentStatus === 'Recibido' && (
              <div className="mt-4">
                <OneDriveDocumentSelector
                  folderUrl={item.carpetaOneDrive}
                  documents={workflowDocuments}
                  description={workflowRequirement.description}
                  requiredDocumentType={workflowRequirement.documentType}
                  onAddDocument={(documentData) => {
                    if (!item || !user) return
                    addWorkflowDocument.mutate({
                      expedientId: item.id,
                      documentData: {
                        ...documentData,
                        tipo: workflowRequirement.documentType,
                        usuario: user.displayName ?? user.email ?? 'Usuario',
                      },
                      userId: user.uid,
                      userName: user.displayName ?? user.email ?? 'Usuario',
                    })
                  }}
                  isLoading={addWorkflowDocument.isPending}
                />
              </div>
            )}
            {requiresFiling(currentStatus) && (
              <div className="mt-4 grid gap-3">
                <Input
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  placeholder="Número de radicado *"
                />
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
            )}
            {workflowRequirement?.required && currentStatus !== 'Recibido' && (
              <div className="mt-4">
                <OneDriveDocumentSelector
                  folderUrl={item.carpetaOneDrive}
                  documents={workflowDocuments}
                  description={workflowRequirement.description}
                  requiredDocumentType={workflowRequirement.documentType}
                  onAddDocument={(documentData) => {
                    if (!item || !user) return
                    addWorkflowDocument.mutate({
                      expedientId: item.id,
                      documentData: {
                        ...documentData,
                        tipo: workflowRequirement.documentType,
                        usuario: user.displayName ?? user.email ?? 'Usuario',
                      },
                      userId: user.uid,
                      userName: user.displayName ?? user.email ?? 'Usuario',
                    })
                  }}
                  isLoading={addWorkflowDocument.isPending}
                />
              </div>
            )}
            <Textarea
              className="mt-4"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observaciones"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(false)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  execute.isPending ||
                  (currentStatus === 'Recibido' && !signed) ||
                  (currentStatus === 'Asignado' && !responsible) ||
                  (currentStatus === 'En respuesta' &&
                    ((choice === 'transfer' && (!destination || !reason)) ||
                      (choice === 'change' && !responsible))) ||
                  (requiresFiling(currentStatus) && (!number || !date)) ||
                  (workflowRequirement?.required && !hasRequiredWorkflowDocument)
                }
                onClick={() => execute.mutate()}
              >
                Guardar y continuar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold">Eliminar expediente</h2>
            <p className="mt-3 text-sm text-slate-600">
              ¿Estás seguro de que deseas eliminar permanentemente este expediente <strong>({item.numeroRadicado})</strong>? Esta acción no se puede deshacer y se eliminarán todos los documentos, observaciones e historial asociados.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteExpedientMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => deleteExpedientMutation.mutate()}
                disabled={deleteExpedientMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteExpedientMutation.isPending ? 'Eliminando...' : 'Eliminar permanentemente'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </section>
  )
}
