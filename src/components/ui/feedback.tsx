import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'info' | 'success' | 'warning' | 'error'

const tones: Record<Tone, { box: string; icon: LucideIcon }> = {
  info: { box: 'border-sky-200 bg-sky-50 text-sky-900', icon: Info },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle },
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: XCircle },
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const { box, icon: Icon } = tones[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', box, className)}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5 leading-6">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}

/** Mensaje de error de una mutación o consulta, o nada si no hay error. */
export function ErrorAlert({ error, fallback }: { error: unknown; fallback: string }) {
  if (!error) return null
  return <Alert tone="error">{error instanceof Error ? error.message : fallback}</Alert>
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon size={26} aria-hidden="true" />
      </div>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />
}

/** Filas de carga para tablas. */
export function TableSkeleton({ rows = 5, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row}>
          {Array.from({ length: columns }, (_, column) => (
            <td key={column}>
              <Skeleton className={cn('h-4', column === 0 ? 'w-28' : 'w-full max-w-36')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
      <span className="size-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      {label}
    </div>
  )
}
