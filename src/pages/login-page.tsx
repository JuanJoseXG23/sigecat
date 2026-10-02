import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { signInWithCredentials } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), mode: 'onTouched' })

  const onSubmit = async (values: LoginForm) => {
    setSubmitError(null)

    try {
      await signInWithCredentials(values)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible iniciar sesión.')
    }
  }

  return (
    <div className="animate-fade-up rounded-2xl border border-border bg-card p-6 shadow-xl shadow-emerald-950/5 sm:p-8">
      <h2 className="text-xl font-bold text-slate-900">Iniciar sesión</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Usa tu correo institucional de la Alcaldía.
      </p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Correo electrónico" error={errors.email?.message}>
          <div className="relative">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="nombre@girardota.gov.co"
              className="h-11 pl-9"
              {...register('email')}
            />
          </div>
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          <div className="relative">
            <LockKeyhole
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="h-11 px-9"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        {submitError && <Alert tone="error">{submitError}</Alert>}
        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Validando acceso…' : 'Ingresar'}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
        ¿Olvidaste tu contraseña o no tienes cuenta? Solicítala al administrador de SIGECAT.
      </p>
    </div>
  )
}
