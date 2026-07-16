'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, UserCog, Puzzle, Settings, Trash2, AlertTriangle, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { useAuthStore } from '@/store/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const settingsSections = [
  {
    href: '/configuracion/marca',
    icon: <Shield size={24} />,
    title: 'Marca',
    description: 'Personalizá el logo, nombre del sistema y la paleta de colores de toda la interfaz.',
    roles: ['SUPER_ADMIN'],
    color: '#6366f1',
  },
  {
    href: '/configuracion/usuarios',
    icon: <UserCog size={24} />,
    title: 'Gestión de Usuarios',
    description: 'Creá, editá, suspendé o eliminá usuarios. Asigná roles y forzá cambio de contraseña.',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    color: '#3b82f6',
  },
  {
    href: '/configuracion/plugins',
    icon: <Puzzle size={24} />,
    title: 'Plugins & Extensiones',
    description: 'Activá o desactivá módulos del CRM como campañas de email e integraciones.',
    roles: ['SUPER_ADMIN'],
    color: '#8b5cf6',
  },
  {
    href: '/configuracion/productos',
    icon: <Package size={24} />,
    title: 'Catálogo de Productos',
    description: 'Administrá los productos físicos (cámaras, kits, equipos) disponibles en el cotizador.',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    color: '#f59e0b',
  },
]

export default function ConfiguracionPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [resetOpen, setResetOpen]   = useState(false)
  const [resetting, setResetting]   = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const filtered = settingsSections.filter(s => !s.roles || (user && s.roles.includes(user.role)))

  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/settings/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESETEAR' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      // Limpia TODA la cache de React Query para que las stats se actualicen sin F5
      qc.clear()
      toast.success(json.message)
      setResetOpen(false)
      setConfirmText('')
    } catch {
      toast.error('Error al resetear')
    } finally {
      setResetting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Configuración</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Administrá tu cuenta y organización</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="surface rounded-2xl p-6 flex flex-col gap-4 hover:border-[var(--color-border-strong)] hover:-translate-y-0.5 hover:shadow-card transition-all duration-200 group"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
              style={{ background: `${section.color}22`, color: section.color }}
            >
              {section.icon}
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-text)] mb-1 group-hover:gradient-text transition-all">
                {section.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                {section.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Danger zone — SUPER_ADMIN only */}
      {user?.role === 'SUPER_ADMIN' && (
        <div className="surface rounded-2xl p-5 border border-red-500/15">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-red-400" />
            <p className="text-sm font-semibold text-red-400">Zona peligrosa</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Limpiar todos los datos de prueba</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Elimina clientes, deals, tareas, tickets, campañas y documentos. Conserva usuarios, servicios y configuración.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={() => setResetOpen(true)}
            >
              Limpiar datos
            </Button>
          </div>
        </div>
      )}

      {/* Reset confirm modal */}
      <Modal open={resetOpen} onClose={() => { setResetOpen(false); setConfirmText('') }} title="¿Seguro que querés limpiar los datos?" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl flex gap-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">
              Esto va a eliminar <strong>todos</strong> los clientes, deals, tareas, tickets, eventos, documentos y campañas. Esta acción <strong>no se puede deshacer</strong>.
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              Escribí <span className="font-mono text-[var(--color-primary)]">LIMPIAR</span> para confirmar:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
              placeholder="LIMPIAR"
            />
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => { setResetOpen(false); setConfirmText('') }}>Cancelar</Button>
            <Button
              variant="danger"
              loading={resetting}
              disabled={confirmText !== 'LIMPIAR'}
              onClick={handleReset}
            >
              Confirmar limpieza
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  )
}
