import { Select } from '@/components/ui/select'
import { CORRESPONDENCE_CLASSES, type CorrespondenceClass } from '@/lib/correspondence'

/** Filtro por clase de correspondencia; el valor vacío muestra las dos. */
export function CorrespondenceFilter({
  value,
  onChange,
  className,
}: {
  value: '' | CorrespondenceClass
  onChange: (value: '' | CorrespondenceClass) => void
  className?: string
}) {
  return (
    <Select
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value as '' | CorrespondenceClass)}
      aria-label="Correspondencia"
    >
      <option value="">Toda la correspondencia</option>
      {CORRESPONDENCE_CLASSES.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </Select>
  )
}
