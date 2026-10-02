import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import { OneDriveDocumentSelector } from '@/components/one-drive-document-selector'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAssignableOfficials } from '@/hooks/use-assignable-officials'
import { useAuth } from '@/hooks/use-auth'
import { useAddExpedientWorkflowDocument } from '@/hooks/use-expedient-workflow-documents'
import {
  EMPTY_ACTUATION_INPUT,
  getMissingRequirement,
  getStepDefinition,
  planActuation,
  type ActuationInput,
  type ResponseChoice,
} from '@/lib/expedient-workflow'
import { applyActuation } from '@/services/expedient.service'
import type { Expedient } from '@/types/expedient'

const AFFECTED_QUERIES = [
  'expedient',
  'expedient-history',
  'expedients',
  'work-tray',
  'historical-expedients',
  'filings',
]

interface ActuationDialogProps {
  expedient: Expedient
  onClose: () => void
  /** Mensaje para mostrar en la página después de guardar, si aplica. */
  onCompleted: (notice?: string) => void
}

export function ActuationDialog({ expedient, onClose, onCompleted }: ActuationDialogProps) {
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const { data: officials = [] } = useAssignableOfficials()
  const addDocument = useAddExpedientWorkflowDocument()
  const [values, setValues] = useState(EMPTY_ACTUATION_INPUT)
  const [responsibleUid, setResponsibleUid] = useState('')
  const status = expedient.estado
  const step = getStepDefinition(status)
  const documents = expedient.documentosWorkflow ?? []
  const responsible = officials.find((entry) => entry.uid === responsibleUid)
  const input: ActuationInput = {
    ...values,
    assignee: responsible && { uid: responsible.uid, nombreCompleto: responsible.nombreCompleto },
  }
  const missing = getMissingRequirement(status, input, documents)
  const update = (changes: Partial<ActuationInput>) => setValues({ ...values, ...changes })

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.')
      const actuation = planActuation(expedient, input)
      await applyActuation(expedient.id, actuation, user.uid)
      return actuation
    },
    onSuccess: async (actuation) => {
      await Promise.all(
        AFFECTED_QUERIES.map((key) => client.invalidateQueries({ queryKey: [key] })),
      )
      onCompleted(
        actuation.kind === 'assign'
          ? `Expediente ${actuation.advanceTo ? 'asignado' : 'reasignado'} a ${actuation.assignee.nombreCompleto}. Enviando correo de notificación; llegará en máximo cinco minutos.`
          : undefined,
      )
    },
  })

  const officialOptions = officials.map((entry) => (
    <option key={entry.uid} value={entry.uid}>
      {entry.nombreCompleto}
    </option>
  ))
  const error = save.error ?? addDocument.error

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-4xl overflow-hidden border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <p className="text-sm font-medium text-primary">{status}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{step.title}</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-10 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <X size={22} />
          </Button>
        </header>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error instanceof Error ? error.message : 'No fue posible guardar la actuación.'}
            </p>
          )}
          {step.requiresSignature && (
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={values.signed}
                onChange={(event) => update({ signed: event.target.checked })}
                className="size-5 rounded border-slate-300 text-primary focus:ring-primary"
              />{' '}
              Confirmo que el formato físico fue firmado.
            </label>
          )}
          {step.requiresAssignee && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Responsable *</label>
              <Select
                value={responsibleUid}
                onChange={(event) => setResponsibleUid(event.target.value)}
              >
                <option value="">Selecciona responsable de Catastro</option>
                {officialOptions}
              </Select>
            </div>
          )}
          {step.offersChoice && (
            <div className="mt-4 space-y-2">
              <Select
                value={values.choice}
                onChange={(event) => update({ choice: event.target.value as ResponseChoice })}
              >
                <option value="response">Respuesta a usuario</option>
                <option value="transfer">Traslado por competencia</option>
                <option value="change">Cambio de responsable</option>
              </Select>
              {values.choice === 'transfer' && (
                <>
                  <Input
                    value={values.destination}
                    onChange={(event) => update({ destination: event.target.value })}
                    placeholder="Dependencia destino *"
                  />
                  <Textarea
                    value={values.reason}
                    onChange={(event) => update({ reason: event.target.value })}
                    placeholder="Motivo del traslado *"
                  />
                </>
              )}
              {values.choice === 'change' && (
                <Select
                  value={responsibleUid}
                  onChange={(event) => setResponsibleUid(event.target.value)}
                >
                  <option value="">Selecciona responsable</option>
                  {officialOptions}
                </Select>
              )}
            </div>
          )}
          {step.document && (
            <div className="mt-4">
              <OneDriveDocumentSelector
                folderUrl={expedient.carpetaOneDrive}
                documents={documents}
                description={step.document.description}
                requiredDocumentType={step.document.type}
                onAddDocument={(document) => {
                  if (!user || !step.document) return
                  const userName = profile?.nombreCompleto ?? user.email ?? 'Usuario'
                  addDocument.mutate({
                    expedientId: expedient.id,
                    documentData: { ...document, tipo: step.document.type, usuario: userName },
                    userId: user.uid,
                    userName,
                  })
                }}
                isLoading={addDocument.isPending}
              />
            </div>
          )}
          {step.requiresFiling && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Número de radicado *</label>
                <Input
                  value={values.filingNumber}
                  onChange={(event) => update({ filingNumber: event.target.value })}
                  placeholder="Ingresa el número de radicado"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Fecha de radicado *</label>
                <Input
                  type="date"
                  value={values.filingDate}
                  onChange={(event) => update({ filingDate: event.target.value })}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Observaciones</label>
            <Textarea
              value={values.notes}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="Escribe observaciones adicionales (opcional)"
              className="min-h-28 resize-y"
            />
          </div>
        </div>
        <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-8">
          {missing && <p className="text-sm text-slate-500 sm:mr-auto">{missing}</p>}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={save.isPending || Boolean(missing)}
            onClick={() => save.mutate()}
            className="gap-2 bg-emerald-600 px-6 text-white hover:bg-emerald-700"
          >
            Guardar y continuar
            <ArrowRight size={18} />
          </Button>
        </footer>
      </Card>
    </div>
  )
}
