import { Select } from '@/components/ui/select'
import { ALL_YEARS } from '@/lib/periods'

/**
 * Año que se consulta en las listas de archivo. "Todos los años" lee el archivo completo: queda
 * disponible, pero no es el valor por defecto.
 */
export function YearFilter({
  value,
  onChange,
  years,
  label = 'Año',
  className,
}: {
  value: string
  onChange: (value: string) => void
  years: number[]
  label?: string
  className?: string
}) {
  return (
    <Select
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
      <option value={ALL_YEARS}>Todos los años (más lento)</option>
    </Select>
  )
}
