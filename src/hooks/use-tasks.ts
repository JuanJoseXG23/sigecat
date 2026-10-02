import { useQuery } from '@tanstack/react-query'
import { listTasks } from '@/services/task.service'

export function useTasks(ownerId?: string) {
  return useQuery({
    queryKey: ['tasks', ownerId],
    queryFn: () => listTasks(ownerId!),
    enabled: Boolean(ownerId),
  })
}
