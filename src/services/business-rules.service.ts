import { Timestamp, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { addBusinessDays, getRemainingBusinessDays } from '@/lib/expedient-deadline'
import { firestore } from '@/services/firebase'

export const BUSINESS_RULES = { dueSoonDays: 3 } as const
export type DeadlineStatus = 'En plazo' | 'Próximo a vencer' | 'Vencido'

export function calculateDeadline(filingDate: string, responseDays: number): Timestamp {
  const [year, month, day] = filingDate.split('-').map(Number)
  return Timestamp.fromDate(addBusinessDays(new Date(year, month - 1, day), responseDays))
}

export function getDeadlineStatus(deadline: Timestamp): { diasRestantes: number; estadoTermino: DeadlineStatus } {
  const diasRestantes = getRemainingBusinessDays(deadline.toDate())
  return { diasRestantes, estadoTermino: diasRestantes < 0 ? 'Vencido' : diasRestantes <= BUSINESS_RULES.dueSoonDays ? 'Próximo a vencer' : 'En plazo' }
}

export async function registerExpedientHistory(expedientId: string, userId: string, action: string, detail?: string): Promise<void> {
  await addDoc(collection(firestore, 'expedientes', expedientId, 'historial'), { usuario: userId, accion: action, detalle: detail ?? '', fecha: serverTimestamp() })
}
