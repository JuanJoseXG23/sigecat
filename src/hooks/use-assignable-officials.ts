import { useQuery } from '@tanstack/react-query'
import { listAssignableOfficials } from '@/services/user-profile.service'

export function useAssignableOfficials() {
  return useQuery({ queryKey: ['assignable-officials'], queryFn: listAssignableOfficials })
}
