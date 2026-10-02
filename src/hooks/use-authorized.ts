import { useAuth } from '@/hooks/use-auth'
import type { UserRole } from '@/types/user'

export function useAuthorized(roles: readonly UserRole[]): boolean {
  return useAuth().hasRole(roles)
}
