import { Clock } from 'lucide-react'

interface TimeElapsedButtonProps {
  diasTranscurridos: number
  diasRestantes?: number
}

export function TimeElapsedButton({ diasTranscurridos, diasRestantes }: TimeElapsedButtonProps) {
  let bgColor = 'bg-green-100'
  let borderColor = 'border-green-300'
  let textColor = 'text-green-700'
  let label = 'En tiempo'

  if (diasRestantes !== undefined) {
    if (diasRestantes < 0) {
      bgColor = 'bg-red-100'
      borderColor = 'border-red-300'
      textColor = 'text-red-700'
      label = 'Vencido'
    } else if (diasRestantes <= 3) {
      bgColor = 'bg-yellow-100'
      borderColor = 'border-yellow-300'
      textColor = 'text-yellow-700'
      label = 'Crítico'
    }
  }

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${bgColor} ${borderColor}`}>
      <Clock size={16} className={textColor} />
      <div>
        <p className={`text-sm font-semibold ${textColor}`}>{diasTranscurridos} días</p>
        <p className={`text-xs ${textColor}`}>{label}</p>
      </div>
    </div>
  )
}
