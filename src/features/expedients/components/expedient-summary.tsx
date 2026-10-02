import { ExternalLink, Hourglass, MapPin, Pencil, Stamp, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { DeadlineBadge } from '@/features/expedients/components/expedient-badges'
import { describeRemainingDays, formatDate, formatLongDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FilingRecord } from '@/services/filing.service'
import { Badge } from '@/components/ui/badge'
import { getClosingDate, isFinalizedExpedient, type Expedient } from '@/types/expedient'

interface ExpedientSummaryProps {
  expedient: Expedient
  filings: FilingRecord[]
  /** Solo para quien puede corregir radicados. */
  onEditFiling?: (filing: FilingRecord) => void
}

function Panel({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-5 shadow-sm', className)}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  )
}

function DeadlinePanel({ item }: { item: Expedient }) {
  if (!item.fechaLimite)
    return (
      <Panel title="Término de respuesta">
        <p className="text-sm text-muted-foreground">Sin fecha límite calculada.</p>
      </Panel>
    )
  if (isFinalizedExpedient(item)) {
    // Después del cierre no corren términos: solo importa si se cerró a tiempo.
    const closing = getClosingDate(item)
    const deadline = item.fechaLimite.toDate()
    deadline.setHours(23, 59, 59, 999)
    const onTime = closing <= deadline
    return (
      <Panel title="Término de respuesta">
        <Badge variant={onTime ? 'success' : 'destructive'} dot>
          {onTime ? 'Cerrado dentro del término' : 'Cerrado fuera del término'}
        </Badge>
        <dl className="mt-4 divide-y divide-border">
          <Detail label="Fecha límite">{formatDate(item.fechaLimite)}</Detail>
          <Detail label="Fecha de cierre">{formatDate(closing)}</Detail>
          {Boolean(item.diasAmpliacion) && (
            <Detail label="Ampliación">+{item.diasAmpliacion} días hábiles</Detail>
          )}
        </dl>
      </Panel>
    )
  }
  const total = (item.diasTermino ?? 0) + (item.diasAmpliacion ?? 0)
  const remaining = item.diasRestantes ?? 0
  const progress = total ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : null
  const bar =
    item.estadoTermino === 'Vencido'
      ? 'bg-destructive'
      : item.estadoTermino === 'Próximo a vencer'
        ? 'bg-warning'
        : 'bg-primary'

  return (
    <Panel title="Término de respuesta">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tabular-nums text-slate-900">
            {Math.abs(remaining)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              {remaining < 0 ? 'días vencido' : 'días hábiles'}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {describeRemainingDays(item.diasRestantes)}
          </p>
        </div>
        <DeadlineBadge status={item.estadoTermino} />
      </div>
      {progress !== null && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className={cn('h-full rounded-full', bar)} style={{ width: `${progress}%` }} />
        </div>
      )}
      <dl className="mt-4 divide-y divide-border">
        <Detail label="Fecha límite">
          <span>{formatLongDate(item.fechaLimite)}</span>
        </Detail>
        {item.diasTermino !== undefined && (
          <Detail label="Término inicial">{item.diasTermino} días hábiles</Detail>
        )}
        {Boolean(item.diasAmpliacion) && (
          <Detail label="Ampliación">+{item.diasAmpliacion} días hábiles</Detail>
        )}
      </dl>
    </Panel>
  )
}

export function ExpedientSummary({
  expedient: item,
  filings,
  onEditFiling,
}: ExpedientSummaryProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Panel title="Solicitantes" icon={<UserRound size={16} className="text-primary" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {item.solicitantes.map((applicant, index) => (
              <div key={index} className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-semibold text-slate-900">{applicant.nombre || 'Sin nombre'}</p>
                <p className="text-muted-foreground">
                  {applicant.tipoSolicitante ?? 'Sin calidad'} · Doc. {applicant.documento || '—'}
                </p>
                <p className="mt-1 text-slate-700">
                  {applicant.correo || 'Sin correo'} · {applicant.telefono || 'Sin teléfono'}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Predios" icon={<MapPin size={16} className="text-primary" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {item.predios.map((property, index) => (
              <div key={index} className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-semibold text-slate-900">
                  {property.direccion || 'Sin dirección'}
                </p>
                <p className="text-muted-foreground">{property.municipio || 'Sin municipio'}</p>
                <p className="mt-1 text-slate-700">
                  Predial: {property.numeroPredial || '—'} · Matrícula:{' '}
                  {property.matriculaInmobiliaria || '—'}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        {Boolean(item.ampliacionesPlazo?.length) && (
          <Panel
            title="Ampliaciones de plazo"
            icon={<Hourglass size={16} className="text-primary" />}
          >
            <ol className="space-y-3">
              {item.ampliacionesPlazo!.map((extension) => (
                <li
                  key={extension.numeroRadicado}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      +{extension.diasSolicitados} días hábiles · radicado{' '}
                      {extension.numeroRadicado}
                    </p>
                    <a
                      href={extension.documentoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link inline-flex items-center gap-1 text-xs"
                    >
                      Ver radicado <ExternalLink size={12} />
                    </a>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Radicado el {formatDate(extension.fechaRadicado)} · Límite{' '}
                    {formatDate(extension.fechaLimiteAnterior)} →{' '}
                    <b className="text-slate-800">{formatDate(extension.fechaLimiteNueva)}</b>
                  </p>
                  <p className="mt-1 text-slate-700">{extension.motivo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Registró: {extension.usuario}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        <Panel title="Observaciones iniciales">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {item.observacionesIniciales || 'Sin observaciones.'}
          </p>
        </Panel>
      </div>

      <div className="space-y-5">
        <DeadlinePanel item={item} />

        <Panel title="Radicación">
          <dl className="divide-y divide-border">
            <Detail label="Radicado de entrada">{item.numeroRadicado}</Detail>
            <Detail label="Fecha de radicado">{formatDate(item.fechaRadicado)}</Detail>
            <Detail label="Fecha de recibido">
              {formatDate(item.fechaRecibido, 'No registrada')}
            </Detail>
            <Detail label="Medio de ingreso">{item.medioIngreso || 'No registrado'}</Detail>
            <Detail label="Responsable">
              {item.funcionarioAsignado?.nombreCompleto ?? item.responsableExterno ?? 'Sin asignar'}
            </Detail>
            <Detail label="Prioridad">{item.prioridad ?? 'Sin prioridad'}</Detail>
          </dl>
        </Panel>

        <Panel title="Radicados asociados" icon={<Stamp size={16} className="text-primary" />}>
          {filings.length ? (
            <ul className="space-y-2">
              {filings.map((filing) => (
                <li key={filing.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-semibold text-slate-900">{filing.numero}</span>
                    <span className="block text-xs text-muted-foreground">
                      {filing.tipo} · {formatDate(filing.fecha)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {onEditFiling && (
                      <button
                        type="button"
                        onClick={() => onEditFiling(filing)}
                        className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-muted hover:text-primary"
                        aria-label={`Corregir el radicado ${filing.numero}`}
                        title="Corregir radicado"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {filing.documentoUrl && (
                      <a
                        href={filing.documentoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-muted hover:text-primary"
                        aria-label={`Abrir soporte del radicado ${filing.numero}`}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay radicados de salida.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
