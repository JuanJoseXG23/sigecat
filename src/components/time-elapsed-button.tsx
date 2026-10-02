import { Clock } from 'lucide-react'
import type { DeadlineStatus } from '@/services/business-rules.service'

interface TimeElapsedButtonProps {
  diasTranscurridos: number
  /** Semáforo calculado con los festivos y el umbral configurados. */
  estadoTermino?: DeadlineStatus
}

const tones: Record<DeadlineStatus, string> = {
  'En plazo': 'border-green-300 bg-green-100 text-green-700',
  'Próximo a vencer': 'border-yellow-300 bg-yellow-100 text-yellow-700',
  Vencido: 'border-red-300 bg-red-100 text-red-700',
}

export function TimeElapsedButton({
  diasTranscurridos,
  estadoTermino = 'En plazo',
}: TimeElapsedButtonProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 ${tones[estadoTermino]}`}
    >
      <Clock size={16} />
      <div>
        <p className="text-sm font-semibold">{diasTranscurridos} días</p>
        <p className="text-xs">{estadoTermino}</p>
      </div>
    </div>
  )
}
