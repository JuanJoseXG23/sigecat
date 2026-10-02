import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { describeRemainingDays } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DeadlineStatus } from '@/services/business-rules.service'
import type { ExpedientPriority, ExpedientStatus } from '@/types/expedient'

const statusVariants: Record<ExpedientStatus, BadgeVariant> = {
  Recibido: 'info',
  Asignado: 'violet',
  'En respuesta': 'brand',
  'Radicado de salida': 'brand',
  'Traslado por competencia': 'violet',
  'Generar radicado de traslado': 'violet',
  'Generar respuesta al ciudadano': 'brand',
  'Radicar respuesta': 'brand',
  'Archivo (Finalizado)': 'success',
  Archivado: 'default',
}

export function StatusBadge({ status }: { status: ExpedientStatus }) {
  return (
    <Badge variant={statusVariants[status] ?? 'default'} dot>
      {status}
    </Badge>
  )
}

const priorityVariants: Record<ExpedientPriority, BadgeVariant> = {
  Alta: 'destructive',
  Media: 'warning',
  Baja: 'default',
}

export function PriorityBadge({ priority }: { priority?: ExpedientPriority }) {
  if (!priority) return <span className="text-xs text-muted-foreground">—</span>
  return <Badge variant={priorityVariants[priority]}>{priority}</Badge>
}

const deadlineTones: Record<DeadlineStatus, { text: string; icon: typeof CheckCircle2 }> = {
  'En plazo': { text: 'text-emerald-700', icon: CheckCircle2 },
  'Próximo a vencer': { text: 'text-amber-700', icon: CalendarClock },
  Vencido: { text: 'text-red-700', icon: AlertTriangle },
}

/** Semáforo del término: fecha límite y días hábiles restantes. */
export function DeadlineCell({
  status,
  remainingDays,
  deadline,
}: {
  status?: DeadlineStatus
  remainingDays?: number
  deadline?: string
}) {
  if (!status) return <span className="text-xs text-muted-foreground">Sin término</span>
  const { text, icon: Icon } = deadlineTones[status]
  return (
    <div className="flex items-start gap-2 whitespace-nowrap md:min-w-[9.5rem]">
      <Icon size={16} className={cn('mt-0.5 shrink-0', text)} aria-hidden="true" />
      <div className="leading-tight">
        {deadline && <p className="font-medium text-slate-800">{deadline}</p>}
        <p className={cn('text-xs font-medium', text)}>{describeRemainingDays(remainingDays)}</p>
      </div>
    </div>
  )
}

export function DeadlineBadge({ status }: { status?: DeadlineStatus }) {
  if (!status) return null
  const variant: BadgeVariant =
    status === 'Vencido' ? 'destructive' : status === 'Próximo a vencer' ? 'warning' : 'success'
  return (
    <Badge variant={variant} dot>
      {status}
    </Badge>
  )
}
