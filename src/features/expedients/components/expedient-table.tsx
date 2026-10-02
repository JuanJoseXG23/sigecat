import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useState, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton, TableSkeleton } from '@/components/ui/feedback'
import {
  DeadlineCell,
  PriorityBadge,
  StatusBadge,
} from '@/features/expedients/components/expedient-badges'
import { formatDate, initials } from '@/lib/format'
import type { Expedient } from '@/types/expedient'

const PAGE_SIZE = 15

interface ExpedientTableProps {
  rows: Expedient[]
  isLoading?: boolean
  isError?: boolean
  empty: ReactNode
  /** Botones por fila (editar, archivar…). */
  actions?: (item: Expedient) => ReactNode
}

function responsibleOf(item: Expedient): string | undefined {
  return item.funcionarioAsignado?.nombreCompleto ?? item.responsableExterno
}

/** Ignora el clic de la fila cuando viene de un botón o enlace interno. */
function fromInteractive(event: MouseEvent): boolean {
  return Boolean((event.target as HTMLElement).closest('a, button, input, select'))
}

function Responsible({ name }: { name?: string }) {
  if (!name)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <Users size={14} /> Sin asignar
      </span>
    )
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[0.7rem] font-bold text-primary">
        {initials(name)}
      </span>
      <span className="max-w-32 truncate text-slate-700">{name}</span>
    </span>
  )
}

export function ExpedientTable({ rows, isLoading, isError, empty, actions }: ExpedientTableProps) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const open = (item: Expedient) => navigate(`/expedientes/${item.id}`)

  if (isError)
    return (
      <div className="table-shell px-5 py-12 text-center text-sm text-destructive">
        No fue posible cargar los expedientes. Revisa tu conexión e intenta de nuevo.
      </div>
    )

  return (
    <div className="table-shell">
      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Estado</th>
              <th>Término</th>
              <th>Responsable</th>
              {actions && (
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton columns={actions ? 5 : 4} />}
            {!isLoading &&
              visible.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer"
                  onClick={(event) => !fromInteractive(event) && open(item)}
                >
                  <td>
                    <span className="flex items-center gap-2">
                      <Link
                        to={`/expedientes/${item.id}`}
                        className="font-semibold text-slate-900 hover:text-primary"
                      >
                        {item.numeroRadicado}
                      </Link>
                      {item.prioridad && <PriorityBadge priority={item.prioridad} />}
                    </span>
                    <p className="max-w-60 truncate text-sm text-slate-700">
                      {item.solicitantes[0]?.nombre || 'Solicitante sin registrar'}
                      {item.solicitantes.length > 1 && (
                        <span className="text-muted-foreground">
                          {' '}
                          +{item.solicitantes.length - 1}
                        </span>
                      )}
                    </p>
                    <p className="max-w-60 truncate text-xs text-muted-foreground">
                      {item.tipoTramite ?? 'Sin tipo de trámite'}
                      {item.asunto ? ` · ${item.asunto}` : ''}
                    </p>
                  </td>
                  <td>
                    <StatusBadge status={item.estado} />
                    {Boolean(item.diasAmpliacion) && (
                      <p className="mt-1 text-xs text-info">Plazo ampliado</p>
                    )}
                  </td>
                  <td>
                    <DeadlineCell
                      status={item.estadoTermino}
                      remainingDays={item.diasRestantes}
                      deadline={formatDate(item.fechaLimite)}
                    />
                  </td>
                  <td>
                    <Responsible name={responsibleOf(item)} />
                  </td>
                  {actions && (
                    <td>
                      <div className="flex items-center justify-end gap-1">{actions(item)}</div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Celular: tarjetas */}
      <ul className="divide-y divide-border md:hidden">
        {isLoading &&
          Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="space-y-2 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </li>
          ))}
        {!isLoading &&
          visible.map((item) => (
            <li key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/expedientes/${item.id}`} className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.numeroRadicado}</p>
                  <p className="truncate text-sm text-slate-600">
                    {item.solicitantes[0]?.nombre || 'Sin solicitante'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.tipoTramite ?? 'Sin tipo de trámite'}
                  </p>
                </Link>
                <PriorityBadge priority={item.prioridad} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <StatusBadge status={item.estado} />
                <DeadlineCell
                  status={item.estadoTermino}
                  remainingDays={item.diasRestantes}
                  deadline={formatDate(item.fechaLimite)}
                />
              </div>
              {actions && <div className="mt-3 flex gap-1">{actions(item)}</div>}
            </li>
          ))}
      </ul>

      {!isLoading && rows.length === 0 && empty}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border px-5 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            {rows.length} expediente{rows.length === 1 ? '' : 's'}
            {totalPages > 1 &&
              ` · mostrando ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, rows.length)}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
