import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast-context'
import { DeadlineCell, StatusBadge } from '@/features/expedients/components/expedient-badges'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/format'
import { getInquiryError, INQUIRY_MAX_LENGTH, INQUIRY_TEMPLATES } from '@/lib/inquiry'
import { cn } from '@/lib/utils'
import { askAboutExpedient } from '@/services/inquiry.service'
import type { Expedient } from '@/types/expedient'

/** Pregunta por correo al responsable de un expediente sobre el estado del trámite. */
export function InquiryDialog({
  expedient,
  onClose,
}: {
  expedient: Expedient
  onClose: () => void
}) {
  const { user } = useAuth()
  const toast = useToast()
  const client = useQueryClient()
  const [question, setQuestion] = useState('')
  const recipient = expedient.funcionarioAsignado
  const error = getInquiryError(question, recipient)

  const send = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.')
      return askAboutExpedient(expedient, question, user.uid)
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['inquiries'] })
      onClose()
      toast({
        title: `Pregunta enviada a ${recipient!.nombreCompleto}`,
        description: 'Llegará a su correo en máximo cinco minutos; la respuesta llegará al tuyo.',
      })
    },
  })

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      busy={send.isPending}
      kicker={`Radicado ${expedient.numeroRadicado}`}
      title="Preguntar al responsable"
      description={
        recipient
          ? `Se enviará por correo a ${recipient.nombreCompleto}, que te responderá directamente.`
          : undefined
      }
      footer={
        <>
          {error && question && (
            <p className="text-sm text-muted-foreground sm:mr-auto">
              <span className="font-medium text-amber-700">Falta:</span> {error}
            </p>
          )}
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button disabled={send.isPending || Boolean(error)} onClick={() => send.mutate()}>
            <Send size={16} /> {send.isPending ? 'Enviando…' : 'Enviar pregunta'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorAlert error={send.error} fallback="No fue posible enviar la pregunta." />
        <div className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <StatusBadge status={expedient.estado} />
            <p className="text-muted-foreground">
              {[expedient.tipoTramite, expedient.solicitantes[0]?.nombre]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="text-muted-foreground">
              Radicado el {formatDate(expedient.fechaRadicado)}
            </p>
          </div>
          <DeadlineCell
            status={expedient.estadoTermino}
            remainingDays={expedient.diasRestantes}
            deadline={expedient.fechaLimite ? formatDate(expedient.fechaLimite) : undefined}
          />
        </div>

        {recipient ? (
          <>
            <div className="space-y-1.5">
              <span className="label">Preguntas frecuentes</span>
              <div className="flex flex-wrap gap-2">
                {INQUIRY_TEMPLATES.map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => setQuestion(template)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-left text-xs transition',
                      question === template
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-slate-700 hover:border-primary/50 hover:text-primary',
                    )}
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label="Tu pregunta"
              required
              hint={`${question.trim().length}/${INQUIRY_MAX_LENGTH} · También queda en el historial del expediente.`}
            >
              <Textarea
                value={question}
                maxLength={INQUIRY_MAX_LENGTH}
                onChange={(event) => setQuestion(event.target.value)}
                className="min-h-28"
              />
            </Field>
          </>
        ) : (
          <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <Mail size={18} className="shrink-0" />
            Este expediente todavía no tiene responsable: no hay a quién preguntarle. Pide a
            Coordinación que lo asigne.
          </p>
        )}
      </div>
    </Dialog>
  )
}
