import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellPlus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { toDateKey } from '@/lib/expedient-deadline'
import { formatLongDate } from '@/lib/format'
import { isSupervisor } from '@/lib/permissions'
import {
  getReminderError,
  MAX_REMINDER_DESCRIPTION,
  MAX_REMINDER_DOCUMENTS,
  MAX_REMINDER_TITLE,
  type ReminderDocument,
} from '@/lib/reminders'
import { createReminders } from '@/services/reminder.service'
import { listDirectory } from '@/services/user-profile.service'

interface ReminderDialogProps {
  /** Día sugerido (yyyy-mm-dd); si ya pasó, se usa hoy. */
  day: string
  /** Persona del calendario que se está viendo; queda elegida al abrir. */
  personUid: string
  onClose: () => void
}

/** Crea un recordatorio: para uno mismo o, si es supervisor, para una o varias personas. */
export function ReminderDialog({ day, personUid, onClose }: ReminderDialogProps) {
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const supervisor = isSupervisor(profile)
  const today = toDateKey(new Date())
  const { data: directory = [] } = useQuery({
    queryKey: ['user-directory'],
    queryFn: listDirectory,
  })
  const people = directory.filter((entry) => entry.activo)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(day < today ? today : day)
  const [recipients, setRecipients] = useState<string[]>([supervisor ? personUid : user!.uid])
  const [documents, setDocuments] = useState<ReminderDocument[]>([])

  const input = {
    titulo: title,
    descripcion: description,
    fecha: date,
    destinatarios: recipients,
    documentos: documents,
  }
  const missing = getReminderError(input, today)
  const toggle = (uid: string) =>
    setRecipients((current) =>
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid],
    )
  const everyone = people.length > 0 && people.every((person) => recipients.includes(person.uid))

  const save = useMutation({
    mutationFn: () =>
      createReminders(
        input,
        { uid: user!.uid, nombreCompleto: profile!.nombreCompleto },
        people
          .filter((person) => recipients.includes(person.uid))
          .map(({ uid, nombreCompleto }) => ({ uid, nombreCompleto })),
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['reminders'] })
      await client.invalidateQueries({ queryKey: ['reminders-sent'] })
      onClose()
    },
  })

  return (
    <Dialog
      open
      onClose={onClose}
      busy={save.isPending}
      size="lg"
      kicker="Calendario"
      title="Nuevo recordatorio"
      description={`El ${date ? formatLongDate(date).toLocaleLowerCase('es-CO') : 'día elegido'}, desde las 7 a. m., llegará un correo a cada persona con el recordatorio y sus documentos.`}
      footer={
        <>
          {missing && (title || documents.length > 0) && (
            <p className="text-sm text-muted-foreground sm:mr-auto">
              <span className="font-medium text-amber-700">Falta:</span> {missing}
            </p>
          )}
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button disabled={save.isPending || Boolean(missing)} onClick={() => save.mutate()}>
            <BellPlus size={17} />
            {save.isPending
              ? 'Guardando…'
              : recipients.length > 1
                ? `Crear para ${recipients.length} personas`
                : 'Crear recordatorio'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorAlert error={save.error} fallback="No fue posible crear el recordatorio." />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field
            label="Recordatorio"
            required
            hint={`${title.trim().length}/${MAX_REMINDER_TITLE} caracteres.`}
          >
            <Input
              autoFocus
              value={title}
              maxLength={MAX_REMINDER_TITLE}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Entregar el informe de peticiones del mes"
            />
          </Field>
          <Field label="Día" required>
            <Input
              type="date"
              min={today}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Detalle"
          hint={`Opcional. ${description.trim().length}/${MAX_REMINDER_DESCRIPTION} caracteres.`}
        >
          <Textarea
            rows={3}
            value={description}
            maxLength={MAX_REMINDER_DESCRIPTION}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Qué hay que hacer, dónde, con quién…"
          />
        </Field>

        {supervisor && (
          <fieldset className="space-y-2">
            <div className="flex items-center justify-between">
              <legend className="label">Para</legend>
              <button
                type="button"
                className="link text-sm"
                onClick={() => setRecipients(everyone ? [] : people.map((person) => person.uid))}
              >
                {everyone ? 'Quitar a todos' : 'Todo el equipo'}
              </button>
            </div>
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
              {people.map((person) => (
                <label
                  key={person.uid}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[hsl(var(--primary))]"
                    checked={recipients.includes(person.uid)}
                    onChange={() => toggle(person.uid)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-slate-900">
                      {person.nombreCompleto}
                      {person.uid === user?.uid && ' (yo)'}
                    </span>
                    <span className="block text-xs text-muted-foreground">{person.rol}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="label">Documentos (opcional)</p>
            {documents.length < MAX_REMINDER_DOCUMENTS && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDocuments([...documents, { nombre: '', url: '' }])}
              >
                <Plus size={15} /> Agregar enlace
              </Button>
            )}
          </div>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sube el archivo al OneDrive institucional, usa <b>Compartir → Copiar vínculo</b> y
              pégalo aquí. Irá en el correo.
            </p>
          ) : (
            documents.map((document, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)_auto]">
                <Input
                  value={document.nombre}
                  onChange={(event) =>
                    setDocuments(
                      documents.map((item, position) =>
                        position === index ? { ...item, nombre: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Nombre. Ej. Circular 012"
                  aria-label={`Nombre del documento ${index + 1}`}
                />
                <Input
                  value={document.url}
                  onChange={(event) =>
                    setDocuments(
                      documents.map((item, position) =>
                        position === index ? { ...item, url: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="https://girardotaa-my.sharepoint.com/…"
                  aria-label={`Enlace del documento ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setDocuments(documents.filter((_, position) => position !== index))
                  }
                  aria-label={`Quitar documento ${index + 1}`}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  )
}
