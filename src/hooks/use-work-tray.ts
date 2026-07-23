import { useQuery } from '@tanstack/react-query'
import { getWorkTray } from '@/services/work-tray.service'
import type { UserRole } from '@/types/user'

export function useWorkTray(role?: UserRole, uid?: string) {
  return useQuery({ queryKey: ['work-tray', role, uid], queryFn: () => getWorkTray(role!, uid!), enabled: Boolean(role && uid) })
}
