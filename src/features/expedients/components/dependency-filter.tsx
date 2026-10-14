import { Select } from '@/components/ui/select'
import { DEPENDENCIES } from '@/lib/dependencies'

/** Filtro por área de la Secretaría; el valor vacío muestra todas. */
export function DependencyFilter({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <Select
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Área"
    >
      <option value="">Todas las áreas</option>
      {DEPENDENCIES.map((item) => (
        <option key={item.id} value={item.id}>
          {item.nombre}
        </option>
      ))}
    </Select>
  )
}
