import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StickyNote } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { getNoteError, MAX_NOTE_LENGTH } from '@/lib/expedient-notes'
import { addExpedientNote } from '@/services/expedient.service'
import type { Expedient } from '@/types/expedient'

interface NoteDialogProps {
  expedient: Expedient
  onClose: () => void
  onCompleted: () => void
}

/** Deja una aclaración en el historial; no se puede editar ni borrar después. */
export function NoteDialog({ expedient, onClose, onCompleted }: NoteDialogProps) {
  const { user } = useAuth()
  const client = useQueryClient()
  const [text, setText] = useState('')
  const missing = getNoteError(text)

  const save = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('La sesión expiró. Vuelve a iniciar sesión.')
      return addExpedientNote(expedient.id, text, user.uid)
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['expedient-history', expedient.id] })
      onCompleted()
    },
  })

  return (
    <Dialog
      open
      onClose={onClose}
      busy={save.isPending}
      kicker={`Radicado ${expedient.numeroRadicado}`}
      title="Agregar nota"
      description="Aclara algo del expediente. Queda en el historial con tu nombre y la fecha, y no se puede editar ni borrar: para corregirla, agrega otra nota."
      footer={
        <>
          {missing && text.trim() && (
            <p className="text-sm text-muted-foreground sm:mr-auto">
              <span className="font-medium text-amber-700">Falta:</span> {missing}
            </p>
          )}
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button disabled={save.isPending || Boolean(missing)} onClick={() => save.mutate()}>
            <StickyNote size={17} />
            {save.isPending ? 'Guardando…' : 'Guardar nota'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorAlert error={save.error} fallback="No fue posible guardar la nota." />
        <Field label="Nota" required hint={`${text.trim().length}/${MAX_NOTE_LENGTH} caracteres.`}>
          <Textarea
            autoFocus
            rows={5}
            value={text}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ej. El radicado de entrada se confirmó con la planilla de Archivo."
          />
        </Field>
      </div>
    </Dialog>
  )
}
