import { cva } from 'class-variance-authority'

/** Estilos de botón; también se usan en enlaces que se ven como botones. */
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 hover:shadow-md active:scale-[0.98]',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90',
        accent:
          'bg-accent text-accent-foreground shadow-sm hover:brightness-95 active:scale-[0.98]',
        outline:
          'border border-input bg-white text-slate-700 shadow-sm hover:border-primary/60 hover:bg-primary/5 hover:text-primary',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-[0.98]',
        'ghost-destructive': 'text-slate-500 hover:bg-red-50 hover:text-destructive',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3',
        lg: 'h-11 px-6',
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)
