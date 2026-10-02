import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  tone?: 'default' | 'destructive'
  pending?: boolean
  /** Deshabilita la confirmación mientras falte un dato. */
  disabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Reemplaza window.confirm con una ventana consistente con el resto de la aplicación. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'default',
  pending = false,
  disabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={pending}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={pending || disabled}>
            {pending ? 'Procesando…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-6 text-slate-600">{children}</div>
    </Dialog>
  )
}
