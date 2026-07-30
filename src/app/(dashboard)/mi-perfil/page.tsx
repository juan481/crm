'use client'

import { useState } from 'react'
import { Eye, EyeOff, Lock, User as UserIcon, Moon, Sun } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/auth-store'
import { useThemeStore } from '@/store/theme-store'
import { ROLE_LABELS } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function MiPerfilPage() {
  const { user, setUser } = useAuthStore()
  const { darkMode, toggleDarkMode } = useThemeStore()

  const [name, setName] = useState(user?.name ?? '')
  const [savingName, setSavingName] = useState(false)

  const [showPass, setShowPass] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  if (!user) return null

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('El nombre no puede estar vacío'); return }
    setSavingName(true)
    try {
      const res = await fetch('/api/auth/mi-perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }
      setUser({ ...user, name: json.data.name })
      toast.success('Nombre actualizado')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { toast.error('Mínimo 8 caracteres'); return }
    if (password !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/auth/mi-perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al cambiar la contraseña'); return }
      toast.success('Contraseña actualizada')
      setPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Mi Perfil</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Tus datos de cuenta y preferencias.</p>
      </div>

      <div className="surface rounded-2xl p-6 flex items-center gap-4">
        <Avatar name={user.name} src={user.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="font-semibold text-[var(--color-text)] truncate">{user.name}</p>
          <p className="text-sm text-[var(--color-text-muted)] truncate">{user.email}</p>
          <span className="inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>
      </div>

      <form onSubmit={handleSaveName} className="surface rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserIcon size={16} className="text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Datos de la cuenta</h2>
        </div>
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" value={user.email} disabled />
        <div className="flex justify-end">
          <Button type="submit" loading={savingName}>Guardar cambios</Button>
        </div>
      </form>

      <form onSubmit={handleChangePassword} className="surface rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Cambiar contraseña</h2>
        </div>
        <div className="relative">
          <Input
            label="Nueva contraseña"
            type={showPass ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3 top-[34px] text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]"
          >
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <Input
          label="Confirmar nueva contraseña"
          type={showPass ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={savingPassword} disabled={!password || !confirmPassword}>
            Actualizar contraseña
          </Button>
        </div>
      </form>

      <div className="surface rounded-2xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {darkMode ? <Moon size={16} className="text-[var(--color-text-muted)]" /> : <Sun size={16} className="text-[var(--color-text-muted)]" />}
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Tema</h2>
            <p className="text-xs text-[var(--color-text-muted)]">{darkMode ? 'Oscuro' : 'Claro'}</p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={toggleDarkMode}>
          Cambiar a {darkMode ? 'claro' : 'oscuro'}
        </Button>
      </div>
    </div>
  )
}
