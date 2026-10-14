import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParticipantScope } from '@/hooks/use-participant-scope'
import { getYearOptions, parseYear } from '@/lib/periods'
import { getFirstYear } from '@/services/expedient.service'
import { getFirstFilingYear } from '@/services/filing.service'

type ArchiveField = 'fechaRadicado' | 'fechaCierre' | 'radicados'

/**
 * Año elegido en una lista de archivo (por defecto el actual) y cómo obtener los años para
 * elegir. Quien ve todo los saca de una lectura del registro más antiguo; el Funcionario, que
 * solo ve lo suyo, de sus propios datos: `yearsFor(años de sus registros)`.
 */
export function useArchiveYear(field: ArchiveField) {
  const participant = useParticipantScope()
  const [value, setValue] = useState(String(new Date().getFullYear()))
  const { data: firstYear } = useQuery({
    queryKey: ['first-year', field],
    queryFn: () => (field === 'radicados' ? getFirstFilingYear() : getFirstYear(field)),
    enabled: !participant,
    staleTime: 60 * 60 * 1000,
  })
  const yearsFor = (ownYears: number[]) =>
    getYearOptions(participant ? (ownYears.length ? Math.min(...ownYears) : undefined) : firstYear)
  return { value, setValue, year: parseYear(value), yearsFor, participant }
}
