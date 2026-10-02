import {
  Timestamp,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type WriteBatch,
} from 'firebase/firestore'
import { addBusinessDays, getRemainingBusinessDays } from '@/lib/expedient-deadline'
import { firestore } from '@/services/firebase'

export const BUSINESS_RULES = { dueSoonDays: 3 } as const
export type DeadlineStatus = 'En plazo' | 'Próximo a vencer' | 'Vencido'

export interface BusinessConfiguration {
  diasFestivos?: string[]
  umbralProximoVencer?: number
  alertasCorreoHabilitadas?: boolean
}

export async function saveBusinessConfiguration(
  values: Required<BusinessConfiguration>,
): Promise<void> {
  const holidays = [...new Set(values.diasFestivos)].sort()
  await setDoc(
    doc(firestore, 'configuracion', 'reglasNegocio'),
    {
      diasFestivos: holidays,
      umbralProximoVencer: values.umbralProximoVencer,
      alertasCorreoHabilitadas: values.alertasCorreoHabilitadas,
      fechaActualizacion: serverTimestamp(),
    },
    { merge: true },
  )
  cachedConfiguration = null
}

async function readBusinessConfiguration(): Promise<Required<BusinessConfiguration>> {
  const snapshot = await getDoc(doc(firestore, 'configuracion', 'reglasNegocio'))
  const data = snapshot.data() as BusinessConfiguration | undefined
  return {
    diasFestivos: data?.diasFestivos ?? [],
    umbralProximoVencer: data?.umbralProximoVencer ?? BUSINESS_RULES.dueSoonDays,
    alertasCorreoHabilitadas: data?.alertasCorreoHabilitadas ?? false,
  }
}

const CONFIGURATION_TTL_MS = 5 * 60_000
let cachedConfiguration: {
  value: Promise<Required<BusinessConfiguration>>
  expiresAt: number
} | null = null

/**
 * Casi todas las lecturas de expedientes necesitan festivos y umbral; se guardan unos minutos
 * para no leer el mismo documento en cada consulta.
 */
export function getBusinessConfiguration(): Promise<Required<BusinessConfiguration>> {
  if (!cachedConfiguration || cachedConfiguration.expiresAt < Date.now()) {
    const value = readBusinessConfiguration()
    value.catch(() => {
      cachedConfiguration = null
    })
    cachedConfiguration = { value, expiresAt: Date.now() + CONFIGURATION_TTL_MS }
  }
  return cachedConfiguration.value
}

export function calculateDeadline(
  filingDate: string,
  responseDays: number,
  holidays: string[] = [],
): Timestamp {
  const [year, month, day] = filingDate.split('-').map(Number)
  return Timestamp.fromDate(addBusinessDays(new Date(year, month - 1, day), responseDays, holidays))
}

export function getDeadlineStatus(
  deadline: Timestamp,
  holidays: string[] = [],
  dueSoonDays: number = BUSINESS_RULES.dueSoonDays,
): { diasRestantes: number; diasVencidos: number; estadoTermino: DeadlineStatus } {
  const diasRestantes = getRemainingBusinessDays(deadline.toDate(), new Date(), holidays)
  const diasVencidos = diasRestantes < 0 ? Math.abs(diasRestantes) : 0
  return {
    diasRestantes,
    diasVencidos,
    estadoTermino:
      diasRestantes < 0
        ? 'Vencido'
        : diasRestantes <= dueSoonDays
          ? 'Próximo a vencer'
          : 'En plazo',
  }
}

export function registerExpedientHistory(
  batch: WriteBatch,
  expedientId: string,
  userId: string,
  action: string,
  detail?: string,
): void {
  batch.set(doc(collection(firestore, 'expedientes', expedientId, 'historial')), {
    usuario: userId,
    accion: action,
    detalle: detail ?? '',
    fecha: serverTimestamp(),
  })
}
