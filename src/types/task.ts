import type { Timestamp } from 'firebase/firestore'
export const TASK_STATUSES = ['Pendientes', 'En proceso', 'Por revisar', 'Finalizadas'] as const
export type TaskStatus = typeof TASK_STATUSES[number]
export type TaskPriority = 'Alta' | 'Media' | 'Baja'
export interface TaskChecklistItem { texto: string; completado: boolean }
export interface AgendaTask { id: string; titulo: string; descripcion?: string; fechaCreacion: Timestamp; fechaLimite?: Timestamp; prioridad: TaskPriority; estado: TaskStatus; responsableId: string; responsable: string; expedienteId?: string; expedienteRadicado?: string; checklist: TaskChecklistItem[]; fechaFinalizacion?: Timestamp }
