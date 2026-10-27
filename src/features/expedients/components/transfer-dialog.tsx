import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { Alert, ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EXPEDIENT_QUERIES } from '@/features/expedients/expedient-queries'
import { useAuth } from '@/hooks/use-auth'
import { getCorrespondenceClass } from '@/lib/correspondence'
import { DEPENDENCIES, getDependencyName, getExpedientDependency } from '@/lib/dependencies'
import { toDateKey } from '@/lib/expedient-deadline'
import {
  EMPTY_TRANSFER_INPUT,
  getTransferError,
  OTHER_DESTINATION,
  type TransferInput,
} from '@/lib/expedient-transfer'
import { formatLongDate } from '@/lib/format'
import { transferExpedient } from '@/services/expedient.service'
import type { Expedient } from '@/types/expedient'

interface TransferDialogProps {
  expedient: Expedient
  onClose: () => void
  onCompleted: (destination: string) => void
}

/** Cierra el expediente como Transferido a otra dependencia, con su traza. */
export function TransferDialog({ expedient, onClose, onCompleted }: TransferDialogProps) {
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const [values, setValues] = useState<TransferInput>({
    ...EMPTY_TRANSFER_INPUT,
    date: toDateKey(new Date()),
  })
  const [showOficio, setShowOficio] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const update = (changes: Partial<TransferInput>) => setValues({ ...values, ...changes })

  const dependency = getExpedientDependency(expedient)
  const internal = getCorrespondenceClass(expedient) === 'Interna'
  const missing = getTransferError(values, {
    dependency,
    entryDate: toDateKey(expedient.fechaRadicado.toDate()),
    correspondenceClass: getCorrespondenceClass(expedient),
  })
  const destinationName =
    values.destination === OTHER_DESTINATION
      ? values.otherDestination.trim()
      : values.destination && getDependencyName(values.destination)

  const save = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.')
      return transferExpedient(
        expedient.id,
        values,
        user.uid,
        profile?.nombreCompleto ?? user.email ?? 'Usuario',
      )
    },
    onSuccess: async () => {
      await Promise.all(
        EXPEDIENT_QUERIES.map((key) => client.invalidateQueries({ queryKey: [key] })),
      )
      onCompleted(destinationName)
    },
    onSettled: () => setConfirming(false),
  })

  return (
    <>
      {/* Mientras se confirma, solo queda abierta la confirmación; lo diligenciado se conserva. */}
      <Dialog
        open={!confirming}
        onClose={onClose}
        size="lg"
        busy={save.isPending}
        kicker={`Radicado ${expedient.numeroRadicado}`}
        title="Transferir a otra dependencia"
        description={`Área actual: ${getDependencyName(dependency)}.`}
        footer={
          <>
            {missing && (
              <p className="text-sm text-muted-foreground sm:mr-auto">
                <span className="font-medium text-amber-700">Falta:</span> {missing}
              </p>
            )}
            <Button variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button
              disabled={save.isPending || Boolean(missing)}
              onClick={() => setConfirming(true)}
            >
              <ArrowRightLeft size={17} /> Transferir y cerrar
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <ErrorAlert error={save.error} fallback="No fue posible transferir el expediente." />
          <Alert tone="info" title="El expediente se cierra aquí">
            Queda constancia de a dónde se envió, cuándo y por qué, y pasa al Histórico. Para
            trasladar y luego responder al ciudadano, use Continuar → Traslado por competencia.
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Destino" required>
              <Select
                value={values.destination}
                onChange={(event) =>
                  update({ destination: event.target.value as TransferInput['destination'] })
                }
              >
                <option value="">Selecciona el destino</option>
                {DEPENDENCIES.filter((item) => item.id !== dependency).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
                <option value={OTHER_DESTINATION}>Otra dependencia de la Alcaldía</option>
              </Select>
            </Field>
            <Field label="Fecha de la transferencia" required>
              <Input
                type="date"
                min={toDateKey(expedient.fechaRadicado.toDate())}
                max={toDateKey(new Date())}
                value={values.date}
                onChange={(event) => update({ date: event.target.value })}
              />
            </Field>
            {values.destination === OTHER_DESTINATION && (
              <Field label="Nombre de la dependencia" required className="sm:col-span-2">
                <Input
                  value={values.otherDestination}
                  onChange={(event) => update({ otherDestination: event.target.value })}
                  placeholder="Ej. Secretaría de Gobierno"
                />
              </Field>
            )}
          </div>

          <Field label="Motivo" required hint="Queda en el historial y en el aviso del expediente.">
            <Textarea
              value={values.reason}
              onChange={(event) => update({ reason: event.target.value })}
              placeholder="Ej. La petición trata de un acuerdo de pago, que es de Tesorería."
              className="min-h-24"
            />
          </Field>

          <section className="rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setShowOficio(!showOficio)}
              aria-expanded={showOficio}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-900"
            >
              Oficio de envío (opcional)
              <ChevronDown
                size={16}
                className={showOficio ? 'rotate-180 transition' : 'transition'}
              />
            </button>
            {showOficio && (
              <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
                <Field label="Número de radicado">
                  <Input
                    value={values.filingNumber}
                    onChange={(event) => update({ filingNumber: event.target.value })}
                    placeholder={internal ? 'Ej. 2026-000410 o 20262000410' : 'Ej. 20262000410'}
                  />
                </Field>
                <Field label="Fecha de radicado">
                  <Input
                    type="date"
                    max={toDateKey(new Date())}
                    value={values.filingDate}
                    onChange={(event) => update({ filingDate: event.target.value })}
                  />
                </Field>
                <Field label="Nombre del documento">
                  <Input
                    value={values.documentName}
                    onChange={(event) => update({ documentName: event.target.value })}
                    placeholder="Ej. Oficio de transferencia"
                  />
                </Field>
                <Field label="Enlace en OneDrive">
                  <Input
                    type="url"
                    value={values.documentUrl}
                    onChange={(event) => update({ documentUrl: event.target.value })}
                    placeholder="https://girardotaa-my.sharepoint.com/…"
                  />
                </Field>
                <Field label="Folios">
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={values.folios}
                    onChange={(event) => update({ folios: event.target.value })}
                  />
                </Field>
              </div>
            )}
          </section>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        title={`¿Transferir a ${destinationName}?`}
        confirmLabel="Transferir y cerrar"
        pending={save.isPending}
        onConfirm={() => save.mutate()}
        onCancel={() => setConfirming(false)}
      >
        El expediente quedará cerrado como Transferido el {formatLongDate(values.date)} y pasará al
        Histórico. No se puede reabrir.
      </ConfirmDialog>
    </>
  )
}
