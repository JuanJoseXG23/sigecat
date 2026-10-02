import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Avatar = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary',
        className,
      )}
      {...props}
    />
  ),
)
Avatar.displayName = 'Avatar'
