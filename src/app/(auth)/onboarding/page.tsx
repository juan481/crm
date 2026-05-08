'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Lock, LayoutDashboard, Users, ArrowRight, Check, SkipForward } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

const STEPS = [
  {
    id: 'welcome',
    icon: <User size={28} />,
    title: '¡Bienvenido al CRM!',
    description: 'Estamos felices de tenerte. Vamos a configurar tu cuenta en 3 pasos rápidos.',
    action: 'Comenzar',
  },
  {
    id: 'profile',
    icon: <Lock size={28} />,
    title: 'Tu perfil y contraseña',
    description: 'Ingresa tu nombre y establece una contraseña segura para tu cuenta.',
    action: 'Confirmar',
  },
  {
    id: 'clients',
    icon: <Users size={28} />,
    title: 'Gestión de Clientes',
    description: 'Desde la sección Clientes podrás agregar, buscar y gestionar todos tus contactos.',
    action: 'Entendido',
  },
  {
    id: 'dashboard',
    icon: <LayoutDashboard size={28} />,
    title: 'Tu Dashboard',
    description: 'El dashboard muestra tus métricas clave: MRR, clientes activos, pagos pendientes y más en tiempo real.',
    action: 'Ir al Dashboard',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const currentStep = STEPS[step]

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const completeOnboarding = async (data?: Partial<FormData>) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data?.name, password: data?.password }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setUser({ ...user!, ...json.data })
      toast.success('¡Cuenta configurada!')
      router.push('/dashboard')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (step === STEPS.length - 1) {
      completeOnboarding()
    } else {
      setStep((s) => s + 1)
    }
  }

  const handleSkip = () => completeOnboarding()

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-4">
      {/* Progress dots */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 flex gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 gradient-bg' : i < step ? 'w-4 bg-[var(--color-primary)]' : 'w-4 bg-[var(--color-border-strong)]'
            }`}
          />
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="fixed top-5 right-6 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        Saltar <SkipForward size={14} />
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="w-full max-w-lg"
        >
          <div className="surface rounded-3xl p-10 shadow-modal">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-8">
              <span className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest">
                Paso {step + 1} de {STEPS.length}
              </span>
            </div>

            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center text-white mb-6">
              {currentStep.icon}
            </div>

            <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">
              {currentStep.title}
            </h1>
            <p className="text-[var(--color-text-muted)] mb-8 leading-relaxed">
              {currentStep.description}
            </p>

            {/* Profile step form */}
            {step === 1 && (
              <form
                onSubmit={handleSubmit((data) => {
                  completeOnboarding(data)
                })}
                className="space-y-4 mb-6"
              >
                <Input
                  label="Tu nombre completo"
                  placeholder={user?.name ?? 'Juan Pérez'}
                  defaultValue={user?.name}
                  {...register('name')}
                  error={errors.name?.message}
                />
                <Input
                  label="Nueva contraseña"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  {...register('password')}
                  error={errors.password?.message}
                />
                <Input
                  label="Confirmar contraseña"
                  type="password"
                  placeholder="Repetir contraseña"
                  {...register('confirmPassword')}
                  error={errors.confirmPassword?.message}
                />
                <Button type="submit" loading={loading} size="lg" className="w-full" rightIcon={<Check size={18} />}>
                  Confirmar y continuar
                </Button>
              </form>
            )}

            {/* Other steps */}
            {step !== 1 && (
              <div className="flex gap-3">
                {step > 0 && (
                  <Button variant="ghost" size="lg" onClick={() => setStep((s) => s - 1)}>
                    Volver
                  </Button>
                )}
                <Button
                  size="lg"
                  className="flex-1"
                  loading={loading}
                  rightIcon={step === STEPS.length - 1 ? <Check size={18} /> : <ArrowRight size={18} />}
                  onClick={handleNext}
                >
                  {currentStep.action}
                </Button>
              </div>
            )}
          </div>

          {/* Tour preview cards */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 grid grid-cols-3 gap-3"
            >
              {['Busca clientes', 'Filtra por estado', 'Exporta en XLS'].map((label) => (
                <div key={label} className="surface rounded-xl p-3 text-center">
                  <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
