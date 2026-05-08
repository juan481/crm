'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, UserCog, MoreVertical, Shield, UserX, KeyRound, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/auth-store'
import { ROLE_LABELS, formatDate } from '@/lib/utils'
import type { User } from '@/types'
import toast from 'react-hot-toast'

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email('Email inválido'),
  role: z.enum(['ADMIN', 'SELLER']),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})
type CreateData = z.infer<typeof createSchema>

const ROLE_OPTIONS = [
  { value: 'SELLER', label: 'Vendedor' },
  { value: 'ADMIN', label: 'Administrador' },
]

export default function UsersPage() {
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [actionUser, setActionUser] = useState<User | null>(null)
  const [action, setAction] = useState<'suspend' | 'delete' | 'password' | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/settings/users')
      const json = await res.json()
      return json.data
    },
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateData>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'SELLER' },
  })

  const users = data ?? []

  const handleCreate = async (data: CreateData) => {
    const res = await fetch('/api/settings/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    toast.success('Usuario creado exitosamente')
    reset()
    setCreateOpen(false)
    qc.invalidateQueries({ queryKey: ['users'] })
  }

  const updateUser = async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/settings/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    toast.success('Usuario actualizado')
    qc.invalidateQueries({ queryKey: ['users'] })
    setActionUser(null)
    setAction(null)
  }

  const deleteUser = async (id: string) => {
    const res = await fetch(`/api/settings/users/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    toast.success('Usuario eliminado')
    qc.invalidateQueries({ queryKey: ['users'] })
    setActionUser(null)
    setAction(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <UserCog size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Usuarios</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{users.length} usuarios en el sistema</p>
          </div>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          Nuevo Usuario
        </Button>
      </div>

      {/* User list */}
      <div className="surface rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[var(--color-border)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-5 animate-pulse">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {users.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 p-5 hover:bg-[var(--color-surface-raised)] transition-colors"
              >
                <Avatar name={user.name} src={user.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[var(--color-text)]">{user.name}</p>
                    {user.id === me?.id && (
                      <Badge variant="primary" size="sm">Tú</Badge>
                    )}
                    <Badge variant={user.status === 'ACTIVE' ? 'success' : 'danger'} size="sm" dot>
                      {user.status === 'ACTIVE' ? 'Activo' : 'Suspendido'}
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] truncate">{user.email}</p>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <Badge variant="neutral" size="sm">
                    <Shield size={11} className="mr-1" />
                    {ROLE_LABELS[user.role]}
                  </Badge>
                  <span className="text-xs text-[var(--color-text-subtle)]">
                    Desde {formatDate(user.createdAt)}
                  </span>
                </div>
                {user.id !== me?.id && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setActionUser(user); setAction('password') }}
                      className="p-2 rounded-lg text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-primary)] transition-all"
                      title="Cambiar contraseña"
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      onClick={() => { setActionUser(user); setAction('suspend') }}
                      className="p-2 rounded-lg text-[var(--color-text-subtle)] hover:bg-amber-500/10 hover:text-amber-400 transition-all"
                      title={user.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
                    >
                      <UserX size={15} />
                    </button>
                    <button
                      onClick={() => { setActionUser(user); setAction('delete') }}
                      className="p-2 rounded-lg text-[var(--color-text-subtle)] hover:bg-red-500/10 hover:text-red-400 transition-all"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create user modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo Usuario" size="md">
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <Input label="Nombre completo" placeholder="Juan Pérez" error={errors.name?.message} {...register('name')} />
          <Input label="Email" type="email" placeholder="juan@empresa.com" error={errors.email?.message} {...register('email')} />
          <Select label="Rol" options={ROLE_OPTIONS} {...register('role')} />
          <Input
            label="Contraseña temporal"
            type="password"
            placeholder="Mínimo 8 caracteres"
            hint="El usuario deberá cambiarla al iniciar sesión"
            error={errors.password?.message}
            {...register('password')}
          />
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Crear Usuario</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Force password change modal */}
      <Modal
        open={action === 'password' && !!actionUser}
        onClose={() => { setActionUser(null); setAction(null) }}
        title="Cambiar Contraseña"
        size="sm"
      >
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Establece una nueva contraseña para <strong className="text-[var(--color-text)]">{actionUser?.name}</strong>.
          El usuario deberá cambiarla en su próximo acceso.
        </p>
        <Input
          label="Nueva contraseña"
          type="password"
          placeholder="Mínimo 8 caracteres"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <ModalFooter className="mt-4">
          <Button variant="ghost" onClick={() => setActionUser(null)}>Cancelar</Button>
          <Button
            onClick={() => updateUser(actionUser!.id, { newPassword, forcePasswordChange: true })}
            disabled={newPassword.length < 8}
          >
            Actualizar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Suspend confirm */}
      <Modal
        open={action === 'suspend' && !!actionUser}
        onClose={() => { setActionUser(null); setAction(null) }}
        title={actionUser?.status === 'ACTIVE' ? 'Suspender Usuario' : 'Reactivar Usuario'}
        size="sm"
      >
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          {actionUser?.status === 'ACTIVE'
            ? `¿Suspender a ${actionUser?.name}? No podrá acceder al CRM hasta que lo reactives.`
            : `¿Reactivar a ${actionUser?.name}? Podrá acceder al CRM nuevamente.`}
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setActionUser(null)}>Cancelar</Button>
          <Button
            variant={actionUser?.status === 'ACTIVE' ? 'danger' : 'success'}
            onClick={() => updateUser(actionUser!.id, {
              status: actionUser?.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
            })}
          >
            {actionUser?.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={action === 'delete' && !!actionUser}
        onClose={() => { setActionUser(null); setAction(null) }}
        title="Eliminar Usuario"
        size="sm"
      >
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          ¿Eliminar a <strong className="text-[var(--color-text)]">{actionUser?.name}</strong>? Esta acción no se puede deshacer.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setActionUser(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteUser(actionUser!.id)}>Eliminar</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
