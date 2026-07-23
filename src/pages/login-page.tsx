import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), mode: 'onChange' })

  const onSubmit = async (values: LoginForm) => {
    setSubmitError(null)

    try {
      await signInWithCredentials(values)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible iniciar sesión.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Bienvenido</h2>
        <p className="mt-1 text-sm text-slate-500">Ingresa tus credenciales para continuar.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mail size={15} />
              Correo electrónico
            </span>
            <Input
              type="email"
              autoComplete="email"
              placeholder="nombre@entidad.gov.co"
              {...register('email')}
            />
            {errors.email && (
              <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <LockKeyhole size={15} />
              Contraseña
            </span>
            <Input type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && (
              <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span>
            )}
          </label>
          {submitError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {submitError}
            </p>
          )}
          <Button className="mt-2 w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Validando acceso…' : 'Iniciar sesión'}
          </Button>
        </form>
      </Card>
    </motion.div>
  )
}
