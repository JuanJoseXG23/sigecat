import { useQuery } from '@tanstack/react-query'
import { getBusinessConfiguration } from '@/services/business-rules.service'
export function useBusinessConfiguration() { return useQuery({ queryKey: ['business-configuration'], queryFn: getBusinessConfiguration }) }
