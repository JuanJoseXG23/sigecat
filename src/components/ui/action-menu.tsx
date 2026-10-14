import { ChevronDown, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export interface MenuAction {
  label: string
  /** Qué hace, en una línea, debajo del nombre. */
  description?: string
  icon: LucideIcon
  onSelect: () => void
}

/** Botón que despliega acciones secundarias; se cierra al elegir, al hacer clic fuera o con Esc. */
export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!actions.length) return null
  return (
    <div ref={container} className="relative">
      <Button
        variant="outline"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label} <ChevronDown size={16} className={open ? 'rotate-180 transition' : 'transition'} />
      </Button>
      {open && (
        <div
          role="menu"
          className="animate-fade-in absolute left-0 z-30 mt-2 w-80 rounded-xl border border-border bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                action.onSelect()
              }}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary/5"
            >
              <action.icon size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{action.label}</span>
                {action.description && (
                  <span className="block text-xs leading-5 text-muted-foreground">
                    {action.description}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
