'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Users, ShieldOff, ShieldCheck, Plus, Gauge, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { getVertical } from '@/lib/verticals'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface AdminOrg {
  id:          string
  name:        string
  domain:      string | null
  crmName:     string
  vertical:    string | null
  suspended:   boolean
  suspendedAt: string | null
  createdAt:   string
  _count:      { users: number }
}

function randomPassword() {
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-6).toUpperCase() + '!1'
}

const emptyForm = { orgName: '', domain: '', existingUserEmail: '', adminName: '', adminEmail: '', adminPassword: '' }

interface DiagResult {
  region: string
  pingMs: number
  queryMs: number
  totalMs: number
  orgCount: number
  timestamp: string
}

export default function AdminOrganizationsPage() {
  const qc = useQueryClient()
  const [actionOrg, setActionOrg] = useState<AdminOrg | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [existingUser, setExistingUser] = useState(false)

  // Diagnostico de velocidad real -- mide en el momento cuanto tarda la
  // funcion serverless en hablar con la base (ping puro + una query real),
  // para poder contestar "esta lento ahora?" con un numero, no una sensacion.
  const [diag, setDiag] = useState<DiagResult | null>(null)
  const [checkingSpeed, setCheckingSpeed] = useState(false)

  const checkSpeed = async () => {
    setCheckingSpeed(true)
    try {
      const res = await fetch('/api/admin/diagnostics')
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al medir'); return }
      setDiag(json.data)
    } catch {
      toast.error('Error de conexion')
    } finally {
      setCheckingSpeed(false)
    }
  }

  const { data, isLoading, isError } = useQuery<AdminOrg[]>({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/organizations')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar organizaciones')
      return json.data
    },
  })

  const orgs = data ?? []

  const toggleSuspend = async (org: AdminOrg) => {
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ suspended: !org.suspended }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al actualizar'); return }
    toast.success(org.suspended ? 'Organización reactivada' : 'Organización suspendida')
    qc.invalidateQueries({ queryKey: ['admin-organizations'] })
    setActionOrg(null)
  }

  const createOrg = async () => {
    setSaving(true)
    try {
      const body = existingUser
        ? { orgName: form.orgName, domain: form.domain, existingUserEmail: form.existingUserEmail }
        : { orgName: form.orgName, domain: form.domain, adminName: form.adminName, adminEmail: form.adminEmail, adminPassword: form.adminPassword }
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al crear la organización'); return }
      toast.success(
        existingUser
          ? `${json.data.organization.name} creada — ${json.data.user.email} ya puede elegirla desde el switcher`
          : `${json.data.organization.name} creada — contraseña inicial: ${form.adminPassword}`
      )
      qc.invalidateQueries({ queryKey: ['admin-organizations'] })
      setCreating(false)
      setForm(emptyForm)
      setExistingUser(false)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Organizaciones</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{orgs.length} organizaciones en el sistema</p>
          </div>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => { setForm({ ...emptyForm, adminPassword: randomPassword() }); setCreating(true) }}>
          Nueva organización
        </Button>
      </div>

      <div className="surface rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
              <Gauge size={18} className="text-white" />
            </div>
            <div>
              <p className="font-medium text-[var(--color-text)]">Diagnostico de velocidad</p>
              <p className="text-xs text-[var(--color-text-muted)]">Mide en el momento cuanto tarda la funcion en hablar con la base</p>
            </div>
          </div>
          <Button variant="outline" size="sm" leftIcon={<RefreshCw size={14} />} loading={checkingSpeed} onClick={checkSpeed}>
            Probar ahora
          </Button>
        </div>
        {diag && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-surface-raised)' }}>
              <p className="text-lg font-bold text-[var(--color-text)]">{diag.region}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Region de la funcion</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-surface-raised)' }}>
              <p className="text-lg font-bold" style={{ color: diag.pingMs > 300 ? '#ef4444' : diag.pingMs > 150 ? '#f59e0b' : '#10b981' }}>{diag.pingMs}ms</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Ping puro a la base</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-surface-raised)' }}>
              <p className="text-lg font-bold" style={{ color: diag.queryMs > 300 ? '#ef4444' : diag.queryMs > 150 ? '#f59e0b' : '#10b981' }}>{diag.queryMs}ms</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Query real</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-surface-raised)' }}>
              <p className="text-lg font-bold" style={{ color: diag.totalMs > 800 ? '#ef4444' : diag.totalMs > 400 ? '#f59e0b' : '#10b981' }}>{diag.totalMs}ms</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Total del pedido</p>
            </div>
          </div>
        )}
        {!diag && (
          <p className="text-xs text-[var(--color-text-subtle)]">Todavia no probaste — toca "Probar ahora" para ver los tiempos reales de este momento.</p>
        )}
      </div>

      <div className="surface rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[var(--color-border)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-5 animate-pulse">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-[var(--color-text-muted)]">Error al cargar las organizaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {orgs.map((org) => (
              <div key={org.id} className="flex items-center gap-4 p-5 hover:bg-[var(--color-surface-raised)] transition-colors">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white shrink-0">
                  <Building2 size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[var(--color-text)]">{org.name}</p>
                    <Badge variant={org.suspended ? 'danger' : 'success'} size="sm" dot>
                      {org.suspended ? 'Suspendida' : 'Activa'}
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] truncate">
                    {org.domain ?? 'sin dominio'} · {org.crmName} · {getVertical(org.vertical)?.label ?? 'sin rubro elegido'}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                    <Users size={14} />{org._count.users}
                  </div>
                  <div className="text-xs text-[var(--color-text-subtle)] text-right">
                    <p>Desde {formatDate(org.createdAt)}</p>
                    {org.suspended && org.suspendedAt && <p>Suspendida desde {formatDate(org.suspendedAt)}</p>}
                  </div>
                </div>
                <button
                  onClick={() => setActionOrg(org)}
                  className={`p-2 rounded-lg transition-all ${
                    org.suspended
                      ? 'text-[var(--color-text-subtle)] hover:bg-emerald-500/10 hover:text-emerald-400'
                      : 'text-[var(--color-text-subtle)] hover:bg-amber-500/10 hover:text-amber-400'
                  }`}
                  title={org.suspended ? 'Reactivar' : 'Suspender'}
                >
                  {org.suspended ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!actionOrg}
        onClose={() => setActionOrg(null)}
        title={actionOrg?.suspended ? 'Reactivar organización' : 'Suspender organización'}
        size="sm"
      >
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          {actionOrg?.suspended
            ? <>¿Reactivar a <strong className="text-[var(--color-text)]">{actionOrg?.name}</strong>? Todos sus usuarios van a poder volver a iniciar sesión.</>
            : <>¿Suspender a <strong className="text-[var(--color-text)]">{actionOrg?.name}</strong>? Ningún usuario de esta organización va a poder iniciar sesión hasta que la reactives — no se borra ningún dato.</>}
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setActionOrg(null)}>Cancelar</Button>
          <Button
            variant={actionOrg?.suspended ? 'success' : 'danger'}
            onClick={() => actionOrg && toggleSuspend(actionOrg)}
          >
            {actionOrg?.suspended ? 'Reactivar' : 'Suspender'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva organización" size="sm">
        <div className="space-y-3 mb-4">
          <Input label="Nombre de la organización" placeholder="Ej. Just Create"
            value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
          <Input label="Dominio (opcional)" placeholder="Ej. justcreate.com.ar"
            value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          <div className="h-px bg-[var(--color-border)] my-1" />

          <label className="flex items-center gap-2.5 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={existingUser}
              onChange={(e) => setExistingUser(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-primary)]"
            />
            <span className="text-sm text-[var(--color-text)]">El primer usuario ya tiene login en el sistema</span>
          </label>

          {existingUser ? (
            <>
              <Input label="Email del usuario existente" type="email" placeholder="ya-tiene-cuenta@dominio.com"
                value={form.existingUserEmail} onChange={(e) => setForm({ ...form, existingUserEmail: e.target.value })} />
              <p className="text-xs text-[var(--color-text-muted)]">
                No se crea una cuenta nueva — ese usuario va a poder elegir esta organización desde el selector del sidebar, sin tocar el acceso que ya tiene a la suya.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">Primer usuario (Super Admin)</p>
              <Input label="Nombre" placeholder="Ej. Juan Cruz"
                value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
              <Input label="Email" type="email" placeholder="admin@dominio.com"
                value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
              <Input label="Contraseña inicial" value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
              <p className="text-xs text-[var(--color-text-muted)]">
                Se le va a pedir que la cambie al iniciar sesión por primera vez, junto con elegir el rubro de la empresa.
              </p>
            </>
          )}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
          <Button
            loading={saving}
            disabled={
              !form.orgName.trim() ||
              (existingUser
                ? !form.existingUserEmail.trim()
                : !form.adminName.trim() || !form.adminEmail.trim() || !form.adminPassword)
            }
            onClick={createOrg}
          >
            Crear organización
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
