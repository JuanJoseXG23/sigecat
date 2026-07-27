import { Timestamp, addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { addBusinessDays, getRemainingBusinessDays } from '@/lib/expedient-deadline'
import { firestore } from '@/services/firebase'

export const BUSINESS_RULES = { dueSoonDays: 3 } as const
export type DeadlineStatus = 'En plazo' | 'Próximo a vencer' | 'Vencido'

export interface BusinessConfiguration {
  diasFestivos?: string[]
  umbralProximoVencer?: number
}

export async function saveBusinessConfiguration(values: Required<BusinessConfiguration>): Promise<void> {
  const holidays = [...new Set(values.diasFestivos)].sort()
  await setDoc(doc(firestore, 'configuracion', 'reglasNegocio'), { diasFestivos: holidays, umbralProximoVencer: values.umbralProximoVencer, fechaActualizacion: serverTimestamp() }, { merge: true })
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

export function getDeadlineStatus(deadline: Timestamp, holidays: string[] = [], dueSoonDays: number = BUSINESS_RULES.dueSoonDays): { diasRestantes: number; diasVencidos: number; estadoTermino: DeadlineStatus } {
  const diasRestantes = getRemainingBusinessDays(deadline.toDate(), new Date(), holidays)
  const diasVencidos = diasRestantes < 0 ? Math.abs(diasRestantes) : 0
  return { diasRestantes, diasVencidos, estadoTermino: diasRestantes < 0 ? 'Vencido' : diasRestantes <= dueSoonDays ? 'Próximo a vencer' : 'En plazo' }
}

export function getDaysElapsedSinceFilingAndTrafficLightStatus(filingDate: Timestamp, deadline: Timestamp, holidays: string[] = []): { diasTranscurridos: number; diasRestantes: number; estado: 'vencido' | 'critico' | 'en-tiempo' } {
  const today = new Date()
  const diasTranscurridos = Math.floor((today.getTime() - filingDate.toDate().getTime()) / (1000 * 60 * 60 * 24))
  const diasRestantes = getRemainingBusinessDays(deadline.toDate(), today, holidays)
  
  let estado: 'vencido' | 'critico' | 'en-tiempo' = 'en-tiempo'
  if (diasRestantes < 0) {
    estado = 'vencido'
  } else if (diasRestantes <= 3) {
    estado = 'critico'
  }
  
  return { diasTranscurridos, diasRestantes, estado }
}

export async function registerExpedientHistory(expedientId: string, userId: string, action: string, detail?: string): Promise<void> {
  await addDoc(collection(firestore, 'expedientes', expedientId, 'historial'), { usuario: userId, accion: action, detalle: detail ?? '', fecha: serverTimestamp() })
}
