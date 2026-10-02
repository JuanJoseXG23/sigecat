import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Timestamp } from 'firebase/firestore'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  Link2,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { ErrorAlert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { useTasks } from '@/hooks/use-tasks'
import { useWorkTray } from '@/hooks/use-work-tray'
import { isInstitutionalDocumentUrl } from '@/lib/document-links'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { createTask, deleteTask, moveTask } from '@/services/task.service'
import { TASK_STATUSES, type AgendaTask, type TaskPriority, type TaskStatus } from '@/types/task'

const columnTones: Record<TaskStatus, string> = {
  Pendientes: 'bg-slate-400',
  'En proceso': 'bg-info',
  'Por revisar': 'bg-warning',
  Finalizadas: 'bg-primary',
}

function dueTone(task: AgendaTask): string {
  if (!task.fechaLimite || task.estado === 'Finalizadas') return 'text-muted-foreground'
  const days = Math.ceil((task.fechaLimite.toDate().getTime() - Date.now()) / 86_400_000)
  return days < 0 ? 'text-red-600' : days <= 2 ? 'text-amber-700' : 'text-muted-foreground'
}

/** Las tareas antiguas guardaban solo el nombre del archivo; se muestran como texto. */
function Attachment({ value }: { value: string }) {
  if (!isInstitutionalDocumentUrl(value)) return <span className="truncate">{value}</span>
  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className="link inline-flex items-center gap-1 truncate text-xs"
    >
      <ExternalLink size={12} className="shrink-0" /> Anexo
    </a>
  )
}

export function AgendaPage() {
  const { user, profile } = useAuth()
  const client = useQueryClient()
  const { data = [] } = useTasks(user?.uid)
  const { data: expedients = [] } = useWorkTray(profile?.rol, user?.uid)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('Media')
  const [expedientId, setExpedientId] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState('')
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)
  const [deleting, setDeleting] = useState<AgendaTask | null>(null)
  const refresh = () => client.invalidateQueries({ queryKey: ['tasks', user?.uid] })
  const close = () => {
    setOpen(false)
    setTitle('')
    setDescription('')
    setDueDate('')
    setPriority('Media')
    setExpedientId('')
    setAttachments([])
    setLink('')
    setLinkError('')
  }
  const addLink = () => {
    const value = link.trim()
    if (!isInstitutionalDocumentUrl(value)) {
      setLinkError('Usa un enlace HTTPS válido de OneDrive o SharePoint institucional.')
      return
    }
    if (!attachments.includes(value)) setAttachments([...attachments, value])
    setLink('')
    setLinkError('')
  }
  const linkedExpedient = expedients.find((item) => item.id === expedientId)
  const create = useMutation({
    mutationFn: () =>
      createTask({
        titulo: title.trim(),
        ...(description.trim() ? { descripcion: description.trim() } : {}),
        prioridad: priority,
        estado: 'Pendientes',
        responsableId: user!.uid,
        responsable: profile?.nombreCompleto ?? '',
        checklist: [],
        anexos: attachments,
        ...(linkedExpedient
          ? { expedienteId: linkedExpedient.id, expedienteRadicado: linkedExpedient.numeroRadicado }
          : {}),
        ...(dueDate ? { fechaLimite: Timestamp.fromDate(new Date(`${dueDate}T00:00:00`)) } : {}),
      }),
    onSuccess: () => {
      close()
      return refresh()
    },
  })
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => moveTask(id, status),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      setDeleting(null)
      await refresh()
    },
  })

  return (
    <section className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        kicker="Organización personal"
        title="Mi agenda"
        description="Tus tareas personales. Arrástralas entre columnas o usa las flechas de cada tarjeta."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} /> Nueva tarea
          </Button>
        }
      />
      <ErrorAlert
        error={move.error ?? remove.error}
        fallback="No fue posible actualizar la tarea."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status, columnIndex) => {
          const tasks = data.filter((task) => task.estado === status)
          return (
            <div
              key={status}
              className={cn(
                'flex min-h-72 flex-col rounded-xl border bg-muted/50 p-3 transition',
                dragOver === status ? 'border-primary bg-primary/5' : 'border-border',
              )}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(status)
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(event) => {
                setDragOver(null)
                const id = event.dataTransfer.getData('text/task')
                if (id) move.mutate({ id, status })
              }}
            >
              <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-slate-800">
                <span className={cn('size-2 rounded-full', columnTones[status])} />
                {status}
                <span className="ml-auto rounded-full bg-white px-2 text-xs text-muted-foreground ring-1 ring-border">
                  {tasks.length}
                </span>
              </h2>
              <div className="flex-1 space-y-2">
                {tasks.map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/task', task.id)}
                    className="cursor-grab rounded-lg border border-border bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{task.titulo}</p>
                      <Badge
                        variant={
                          task.prioridad === 'Alta'
                            ? 'destructive'
                            : task.prioridad === 'Media'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {task.prioridad}
                      </Badge>
                    </div>
                    {task.descripcion && (
                      <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-slate-600">
                        {task.descripcion}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {task.fechaLimite && (
                        <span className={cn('inline-flex items-center gap-1', dueTone(task))}>
                          <CalendarDays size={12} /> {formatDate(task.fechaLimite)}
                        </span>
                      )}
                      {task.expedienteId && (
                        <Link
                          to={`/expedientes/${task.expedienteId}`}
                          className="link inline-flex items-center gap-1"
                        >
                          <FolderOpen size={12} /> {task.expedienteRadicado ?? 'Expediente'}
                        </Link>
                      )}
                      {task.anexos?.map((value) => (
                        <Attachment key={value} value={value} />
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={columnIndex === 0 || move.isPending}
                          onClick={() =>
                            move.mutate({ id: task.id, status: TASK_STATUSES[columnIndex - 1] })
                          }
                          aria-label={`Mover a ${TASK_STATUSES[columnIndex - 1] ?? ''}`}
                        >
                          <ChevronLeft size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={columnIndex === TASK_STATUSES.length - 1 || move.isPending}
                          onClick={() =>
                            move.mutate({ id: task.id, status: TASK_STATUSES[columnIndex + 1] })
                          }
                          aria-label={`Mover a ${TASK_STATUSES[columnIndex + 1] ?? ''}`}
                        >
                          <ChevronRight size={15} />
                        </Button>
                      </div>
                      <Button
                        variant="ghost-destructive"
                        size="icon"
                        className="size-7"
                        onClick={() => setDeleting(task)}
                        aria-label={`Eliminar ${task.titulo}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </article>
                ))}
                {!tasks.length && (
                  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    Sin tareas
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog
        open={open}
        onClose={close}
        busy={create.isPending}
        title="Nueva tarea"
        description="Solo el título es obligatorio."
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Creando…' : 'Crear tarea'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <ErrorAlert error={create.error} fallback="No fue posible crear la tarea." />
          <Field label="Título" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha límite">
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </Field>
            <Field label="Prioridad">
              <Select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                <option>Alta</option>
                <option>Media</option>
                <option>Baja</option>
              </Select>
            </Field>
          </div>
          {expedients.length > 0 && (
            <Field label="Expediente relacionado">
              <Select value={expedientId} onChange={(event) => setExpedientId(event.target.value)}>
                <option value="">Ninguno</option>
                {expedients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.numeroRadicado} · {item.solicitantes[0]?.nombre ?? 'Sin solicitante'}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Descripción">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-20"
            />
          </Field>
          <Field label="Anexos de OneDrive" error={linkError || undefined}>
            <div className="flex gap-2">
              <Input
                value={link}
                onChange={(event) => setLink(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addLink()
                  }
                }}
                placeholder="https://…sharepoint.com/…"
              />
              <Button variant="outline" disabled={!link.trim()} onClick={addLink}>
                <Link2 size={16} /> Agregar
              </Button>
            </div>
          </Field>
          {attachments.map((value) => (
            <div
              key={value}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs"
            >
              <span className="truncate">{value}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Quitar anexo"
                onClick={() => setAttachments(attachments.filter((item) => item !== value))}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar tarea"
        confirmLabel="Eliminar"
        tone="destructive"
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      >
        ¿Eliminar la tarea “{deleting?.titulo}”? Esta acción no se puede deshacer.
      </ConfirmDialog>
    </section>
  )
}
