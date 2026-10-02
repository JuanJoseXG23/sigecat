import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ExpedientStatus } from '@/types/expedient'

interface WorkflowStepperProps {
  flow: ExpedientStatus[]
  /** Posición del estado actual en el flujo; -1 si el estado no pertenece a él. */
  currentIndex: number
  canContinue: boolean
  onContinue: () => void
}

export function WorkflowStepper({
  flow,
  currentIndex,
  canContinue,
  onContinue,
}: WorkflowStepperProps) {
  return (
    <Card className="overflow-x-auto p-4">
      <div className="flex min-w-[700px] gap-2">
        {flow.map((value, index) => (
          <div key={value} className="flex flex-1 items-center gap-2">
            <div
              className={`w-full rounded-lg border p-3 ${index === currentIndex ? 'border-primary bg-primary text-primary-foreground' : index < currentIndex ? 'border-emerald-200 bg-emerald-50' : 'bg-white'}`}
            >
              <span className="block text-xs">
                {index < currentIndex ? <Check size={14} /> : index + 1}
              </span>
              <b className="text-sm">{value}</b>
              {index === currentIndex && canContinue && (
                <Button className="mt-2 w-full" size="sm" variant="outline" onClick={onContinue}>
                  Continuar
                </Button>
              )}
            </div>
            {index < flow.length - 1 && <span>→</span>}
          </div>
        ))}
      </div>
    </Card>
  )
}
