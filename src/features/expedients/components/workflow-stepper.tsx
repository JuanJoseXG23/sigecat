import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExpedientStatus } from '@/types/expedient'

interface WorkflowStepperProps {
  flow: ExpedientStatus[]
  /** Posición del estado actual en el flujo; -1 si el estado no pertenece a él. */
  currentIndex: number
}

/** Pasos del flujo: hechos, actual y pendientes. Horizontal en escritorio, vertical en celular. */
export function WorkflowStepper({ flow, currentIndex }: WorkflowStepperProps) {
  const finished = currentIndex === flow.length - 1
  return (
    <ol
      className="flex flex-col gap-0 md:flex-row md:items-start"
      aria-label="Flujo del expediente"
    >
      {flow.map((value, index) => {
        const done = index < currentIndex || (finished && index === currentIndex)
        const current = index === currentIndex && !finished
        return (
          <li
            key={value}
            className="relative flex gap-3 pb-5 last:pb-0 md:flex-1 md:flex-col md:items-center md:gap-2 md:pb-0 md:text-center"
            aria-current={current ? 'step' : undefined}
          >
            {index < flow.length - 1 && (
              <span
                className={cn(
                  'absolute left-[0.9rem] top-8 h-[calc(100%-2rem)] w-0.5 md:left-[calc(50%+1.25rem)] md:top-[0.9rem] md:h-0.5 md:w-[calc(100%-2.5rem)]',
                  index < currentIndex ? 'bg-primary' : 'bg-border',
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-4 ring-card',
                done && 'bg-primary text-white',
                current && 'bg-accent text-accent-foreground shadow-md shadow-accent/50',
                !done && !current && 'border-2 border-border bg-card text-muted-foreground',
              )}
            >
              {done ? <Check size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={cn(
                'pt-1 text-xs leading-tight md:max-w-[8.5rem] md:pt-0',
                current
                  ? 'font-semibold text-slate-900'
                  : done
                    ? 'text-slate-700'
                    : 'text-muted-foreground',
              )}
            >
              {value}
              {current && <span className="block font-normal text-primary">Paso actual</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
