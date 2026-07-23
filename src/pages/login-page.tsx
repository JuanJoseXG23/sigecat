import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Building2, LockKeyhole, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})
type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), mode: 'onChange' })
  const onSubmit = () => undefined
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary text-white">
            <Building2 />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">SIGECAT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistema Integral de Gestión Catastral Documental
          </p>
        </div>
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
            <Button className="mt-2 w-full" type="submit">
              Iniciar sesión
            </Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-400">
          Municipio de Girardota · Secretaría de Hacienda y Desarrollo Económico
        </p>
      </motion.div>
    </main>
  )
}
