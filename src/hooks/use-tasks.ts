import { useQuery } from '@tanstack/react-query'
import { listTasks } from '@/services/task.service'
export function useTasks() { return useQuery({ queryKey: ['tasks'], queryFn: listTasks }) }
