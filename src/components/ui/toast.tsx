import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastOptions, type ToastTone } from '@/components/ui/toast-context'
import { cn } from '@/lib/utils'

interface ToastItem extends ToastOptions {
  id: number
}

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={20} className="text-primary" />,
  error: <XCircle size={20} className="text-destructive" />,
  info: <Info size={20} className="text-info" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = (nextId.current += 1)
      setItems((current) => [...current.slice(-2), { ...options, id }])
      window.setTimeout(() => dismiss(id), options.tone === 'error' ? 8000 : 5500)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:w-96"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'animate-slide-up pointer-events-auto flex w-full gap-3 rounded-xl border bg-white p-4 shadow-xl shadow-slate-900/10',
              item.tone === 'error' ? 'border-red-200' : 'border-border',
            )}
          >
            <span className="mt-0.5 shrink-0">{icons[item.tone ?? 'success']}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="-m-1 grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cerrar aviso"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
