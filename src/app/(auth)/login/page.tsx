'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useThemeStore } from '@/store/theme-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const { crmName, logoUrl } = useThemeStore()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Error al iniciar sesión')
        return
      }

      setUser(json.data)

      if (!json.data.onboardingCompleted) {
        router.push('/onboarding')
      } else {
        router.push('/dashboard')
      }
    } catch {
      toast.error('Error de conexión. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      {/* Left decorative panel */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 gradient-bg relative overflow-hidden"
      >
        {/* Orbs */}
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-32 right-16 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-white/8 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl">{crmName}</span>
          </div>

          <div>
            <h1 className="text-5xl font-bold text-white leading-tight mb-4">
              Gestiona tu<br />negocio de<br />manera{' '}
              <span className="text-white/70">inteligente.</span>
            </h1>
            <p className="text-white/60 text-lg">
              CRM White-Label premium para agencias y empresas modernas.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { value: '100%', label: 'Mobile-first' },
              { value: 'WL', label: 'White Label' },
              { value: '∞', label: 'Clientes' },
              { value: '24/7', label: 'Disponible' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-white/60 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white font-bold">
              {crmName.charAt(0)}
            </div>
            <span className="font-bold text-xl text-[var(--color-text)]">{crmName}</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[var(--color-text)] mb-2">Bienvenido</h2>
            <p className="text-[var(--color-text-muted)]">
              Ingresa tus credenciales para acceder al CRM
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Contraseña"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              error={errors.password?.message}
              rightIcon={
                <button type="button" onClick={() => setShowPass(!showPass)} className="p-1 hover:text-[var(--color-text)] transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              {...register('password')}
            />

            <Button type="submit" loading={loading} size="lg" className="w-full mt-2" leftIcon={<LogIn size={18} />}>
              Iniciar Sesión
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-[var(--color-text-subtle)]">
            ¿Problemas para acceder? Contacta a tu administrador.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
