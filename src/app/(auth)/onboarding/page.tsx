'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Lock, LayoutDashboard, Users, ArrowRight, Check, SkipForward, Building2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VERTICALS } from '@/lib/verticals'
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

const BASE_STEPS = [
  {
    id: 'welcome',
    icon: <User size={28} />,
    title: '¡Bienvenido al CRM!',
    description: 'Estamos felices de tenerte. Vamos a configurar tu cuenta en unos pasos rápidos.',
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

const VERTICAL_STEP = {
  id: 'vertical',
  icon: <Building2 size={28} />,
  title: '¿Qué tipo de empresa sos?',
  description: 'El sistema ajusta módulos y configuraciones según tu rubro. Podés cambiarlo después desde Configuración.',
  action: 'Continuar',
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  // null = todavía no sabemos; true = hay que insertar el paso de rubro
  const [needsVertical, setNeedsVertical] = useState<boolean | null>(null)
  const [vertical, setVertical] = useState<string | null>(null)
  const [verticalJustSet, setVerticalJustSet] = useState(false)

  useEffect(() => {
    fetch('/api/organization/vertical')
      .then((r) => r.json())
      .then((json) => {
        const canSet = json?.data?.canSet
        const current = json?.data?.vertical
        setNeedsVertical(Boolean(canSet && !current))
      })
      .catch(() => setNeedsVertical(false))
  }, [])

  // Un usuario multi-organización que ya completó su onboarding personal una
  // vez (ej. Juan, ya con cuenta en Abba) puede llegar acá de nuevo sólo
  // porque entró a una organización nueva sin rubro elegido — no tiene
  // sentido pedirle de nuevo nombre/contraseña, sólo el rubro.
  const alreadyOnboarded = user?.onboardingCompleted ?? false

  const STEPS = useMemo(() => {
    if (!needsVertical) return BASE_STEPS
    if (alreadyOnboarded) return [VERTICAL_STEP]
    // Va justo después de "welcome" — antes de pedir nombre/contraseña, para
    // que el resto del wizard (y el tour que sigue) ya sepan el rubro.
    return [BASE_STEPS[0], VERTICAL_STEP, ...BASE_STEPS.slice(1)]
  }, [needsVertical, alreadyOnboarded])

  const currentStep = STEPS[step]

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // `vertOverride` cubre el caso en que se llama justo después de elegir el
  // rubro (chooseVertical), donde el estado `vertical`/`verticalJustSet`
  // todavía no se actualizó en este closure — evita depender de un re-render
  // antes de decidir a dónde redirigir.
  const completeOnboarding = async (data?: Partial<FormData>, vertOverride?: string) => {
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
      const v = vertOverride ?? vertical
      // Si recién eligió el rubro en este mismo wizard, lo llevamos al tour
      // (ayuda/presentacion) filtrado por ese rubro antes del dashboard —
      // es la primera vez que ve el sistema, tiene sentido explicárselo.
      if ((verticalJustSet || vertOverride) && v) {
        router.push(`/ayuda/presentacion?first=1&vertical=${v}`)
      } else {
        router.push('/dashboard')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const chooseVertical = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/organization/vertical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical: id }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'No se pudo guardar el rubro'); return }
      setVertical(id)
      setVerticalJustSet(true)
      if (step === STEPS.length - 1) {
        // Único paso (usuario que ya estaba onboarded) — termina directo.
        await completeOnboarding(undefined, id)
      } else {
        setStep((s) => s + 1)
      }
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

  if (needsVertical === null) {
    // Evita el flash del wizard sin el paso de rubro mientras se resuelve el fetch.
    return <div className="min-h-screen bg-[var(--color-bg)]" />
  }

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

      {/* Skip button — no aplica en el paso de rubro, es obligatorio elegir uno */}
      {currentStep.id !== 'vertical' && (
        <button
          onClick={handleSkip}
          className="fixed top-5 right-6 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Saltar <SkipForward size={14} />
        </button>
      )}

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

            {/* Vertical step: grid de rubros en vez de form/botón */}
            {currentStep.id === 'vertical' && (
              <div className="space-y-3 mb-2">
                {VERTICALS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={loading}
                    onClick={() => chooseVertical(v.id)}
                    className="w-full text-left surface border border-[var(--color-border)] rounded-2xl p-4 hover:border-[var(--color-primary)] transition-colors disabled:opacity-50"
                  >
                    <p className="font-semibold text-[var(--color-text)]">{v.label}</p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{v.description}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Profile step form */}
            {currentStep.id === 'profile' && (
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

            {/* Other steps (welcome, clients, dashboard) */}
            {currentStep.id !== 'profile' && currentStep.id !== 'vertical' && (
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
          {currentStep.id === 'clients' && (
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
