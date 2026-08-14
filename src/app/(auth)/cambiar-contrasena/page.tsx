'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Shield, Eye, EyeOff } from 'lucide-react'

// Pantalla obligatoria cuando User.forcePasswordChange = true (ver el
// chequeo en (dashboard)/layout.tsx) — dos casos reales que antes no
// llevaban acá nunca:
// 1. Un ADMIN crea un usuario con contraseña temporal, y esa persona
//    aprieta "Saltar" en el paso de contraseña del onboarding
//    (src/app/(auth)/onboarding/page.tsx) sin cambiarla.
// 2. Un ADMIN resetea la contraseña de un usuario que YA completó su
//    onboarding hace tiempo — ese usuario nunca vuelve a pasar por
//    /onboarding, así que sin este chequeo entraba directo al dashboard
//    con la contraseña que el ADMIN acaba de definir, sin ninguna
//    oportunidad (ni obligación) de cambiarla.
// A diferencia de /reset-password (recuperación vía link de "olvidé mi
// contraseña", que cierra sesión al terminar porque la persona no estaba
// realmente logueada antes), acá la persona YA está autenticada — al
// guardar sigue directo al dashboard, no se la desloguea.
export default function CambiarContrasenaPage() {
  const router = useRouter()
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return }

    setSaving(true)
    try {
      // Mismo endpoint que ya usa Mi Perfil — ya actualiza la contraseña en
      // Supabase Auth Y limpia forcePasswordChange en la misma operación.
      const res = await fetch('/api/auth/mi-perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f8fafc' }}>
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Shield size={18} />
          </div>
        </div>

        <div className="rounded-3xl p-8 lg:p-10"
          style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div className="mb-7">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: '#ede9fe' }}>
              <Lock size={24} style={{ color: '#6366f1' }} />
            </div>
            <h2 className="text-2xl font-bold mb-1.5" style={{ color: '#1e293b' }}>
              Elegí tu contraseña
            </h2>
            <p className="text-sm" style={{ color: '#64748b' }}>
              Por seguridad, tenés que definir tu propia contraseña antes de seguir. Mínimo 8 caracteres.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#475569' }}>
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="form-input pr-12"
                />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#475569' }}>
                Confirmar contraseña
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetir contraseña"
                required
                className="form-input"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                <span className="shrink-0">✕</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
              {saving ? (
                <span className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              ) : <Lock size={16} />}
              {saving ? 'Guardando...' : 'Guardar y continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
