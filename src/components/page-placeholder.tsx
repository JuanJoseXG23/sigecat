import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface PagePlaceholderProps {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
}

export function PagePlaceholder({ eyebrow, title, description, icon: Icon }: PagePlaceholderProps) {
  return (
    <section className="mx-auto max-w-5xl">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <Card className="mt-6 flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon size={23} aria-hidden="true" />
        </div>
        <p className="mt-5 text-base font-medium text-slate-800">Módulo en preparación</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      </Card>
    </section>
  )
}
