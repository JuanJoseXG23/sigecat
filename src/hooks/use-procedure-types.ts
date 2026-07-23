import { useQuery } from '@tanstack/react-query'
import { listProcedureTypes } from '@/services/procedure-type.service'

export function useProcedureTypes() {
  return useQuery({ queryKey: ['procedure-types'], queryFn: listProcedureTypes })
}
