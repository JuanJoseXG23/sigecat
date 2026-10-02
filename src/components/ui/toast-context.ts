import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
}

export const ToastContext = createContext<((options: ToastOptions) => void) | null>(null)

/** Muestra un aviso temporal en la esquina de la pantalla. */
export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast debe usarse dentro de ToastProvider.')
  return toast
}
