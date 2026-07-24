import { Timestamp, addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { addBusinessDays, getRemainingBusinessDays } from '@/lib/expedient-deadline'
import { firestore } from '@/services/firebase'

export const BUSINESS_RULES = { dueSoonDays: 3 } as const
export type DeadlineStatus = 'En plazo' | 'Próximo a vencer' | 'Vencido'

interface BusinessConfiguration {
  diasFestivos?: string[]
  umbralProximoVencer?: number
}

export async function getBusinessConfiguration(): Promise<Required<BusinessConfiguration>> {
  const snapshot = await getDoc(doc(firestore, 'configuracion', 'reglasNegocio'))
  const data = snapshot.data() as BusinessConfiguration | undefined
  return {
    diasFestivos: data?.diasFestivos ?? [],
    umbralProximoVencer: data?.umbralProximoVencer ?? BUSINESS_RULES.dueSoonDays,
  }
}

export function calculateDeadline(filingDate: string, responseDays: number, holidays: string[] = []): Timestamp {
  const [year, month, day] = filingDate.split('-').map(Number)
  return Timestamp.fromDate(addBusinessDays(new Date(year, month - 1, day), responseDays, holidays))
}

export function getDeadlineStatus(deadline: Timestamp, holidays: string[] = [], dueSoonDays: number = BUSINESS_RULES.dueSoonDays): { diasRestantes: number; estadoTermino: DeadlineStatus } {
  const diasRestantes = getRemainingBusinessDays(deadline.toDate(), new Date(), holidays)
  return { diasRestantes, estadoTermino: diasRestantes < 0 ? 'Vencido' : diasRestantes <= dueSoonDays ? 'Próximo a vencer' : 'En plazo' }
}

export async function registerExpedientHistory(expedientId: string, userId: string, action: string, detail?: string): Promise<void> {
  await addDoc(collection(firestore, 'expedientes', expedientId, 'historial'), { usuario: userId, accion: action, detalle: detail ?? '', fecha: serverTimestamp() })
}
