'use client'

// Objetivos de venta por mes — pedido de Abba (Seba, 2026-10-01): definir un
// objetivo general (ej. USD 60k) y repartirlo a mano entre el equipo (ej. él
// se asigna 30k), editable sobre la marcha según el rendimiento de cada uno.
// El "objetivo general" no se carga aparte: es la suma de lo repartido, así
// nunca queda desincronizado (ver SalesTarget en schema.prisma). El "real" se
// calcula de los mismos deals que ya trae la página de Pipeline (GANADO con
// closedAt en el mes) — sin endpoint nuevo para eso.

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Target, TrendingDown } from 'lucide-react'
import { formatMoneyExact } from '@/lib/utils'
import { argentinaDayKey } from '@/lib/timezone'
import { useAuthStore } from '@/store/auth-store'
import type { Deal } from '@/types'
import toast from 'react-hot-toast'

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
// Argentina-aware, no el reloj local del navegador — este panel y
// ComisionesPanel (abajo en la misma página) tienen que arrancar mirando el
// mismo mes (bug encontrado en code-review al sumar ComisionesPanel, que sí
// usa argentinaDayKey porque CommissionLedger escribe el mes así).
const currentMonth = () => argentinaDayKey().slice(0, 7)

interface Usuario { id: string; name: string; role: string }
interface TargetRow { id: string; userId: string; amount: number; currency: string; user: { id: string; name: string } }

const ROLES_VENTA = ['SUPER_ADMIN', 'ADMIN', 'ADMINISTRATIVO', 'SELLER', 'TECHNICIAN']

export function ObjetivosPanel({ deals, isAdmin }: { deals: Deal[]; isAdmin: boolean }) {
  const qc = useQueryClient()
  const { user: me } = useAuthStore()
  const [month, setMonth] = useState(currentMonth())
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  // La lista completa del equipo sólo hace falta para repartir (ADMIN+) — un
  // vendedor/técnico no necesita ni debe traerse el roster entero, sólo ve su
  // propia fila. Reportado por Abba: a Kevin (Técnico) le aparecían los
  // objetivos de todo el equipo.
  const { data: usuariosData } = useQuery({
    queryKey: ['usuarios-objetivos'],
    queryFn: async () => (await fetch('/api/usuarios')).json(),
    staleTime: 5 * 60_000,
    enabled: isAdmin,
  })
  const usuarios: Usuario[] = isAdmin
    ? (usuariosData?.data ?? []).filter((u: Usuario) => ROLES_VENTA.includes(u.role))
    : me ? [{ id: me.id, name: me.name, role: me.role }] : []

  const { data: targetsData, isLoading } = useQuery({
    queryKey: ['sales-targets', month],
    queryFn: async () => {
      const res = await fetch(`/api/sales-targets?month=${month}`)
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 30_000,
  })
  const targets: TargetRow[] = targetsData?.data ?? []
  const targetByUser = useMemo(() => new Map(targets.map((t) => [t.userId, t])), [targets])

  // Real vendido este mes = deals GANADO con closedAt dentro del mes, por owner.
  const realByUser = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of deals) {
      if (d.stage !== 'GANADO' || !d.closedAt || !d.owner) continue
      const cd = new Date(d.closedAt)
      const key = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}`
      if (key !== month) continue
      // Todo a USD de forma simplificada — si hay deals en otra moneda se sigue
      // sumando igual (el objetivo se carga en USD); no hace falta más para
      // el caso de Abba hoy.
      map.set(d.owner.id, (map.get(d.owner.id) ?? 0) + d.amount)
    }
    return map
  }, [deals, month])

  // Gente a mostrar: cualquiera con usuario interno habilitado a vender, O que
  // ya vendió algo este mes aunque no tenga fila de usuario (poco probable,
  // pero no se pierde el dato).
  const rows = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>()
    for (const u of usuarios) byId.set(u.id, { id: u.id, name: u.name })
    for (const t of targets) if (!byId.has(t.userId)) byId.set(t.userId, t.user)
    return Array.from(byId.values()).sort((a, b) => {
      const ta = targetByUser.get(a.id)?.amount ?? 0
      const tb = targetByUser.get(b.id)?.amount ?? 0
      if (tb !== ta) return tb - ta
      return (realByUser.get(b.id) ?? 0) - (realByUser.get(a.id) ?? 0)
    })
  }, [usuarios, targets, targetByUser, realByUser])

  const totalObjetivo = targets.reduce((s, t) => s + t.amount, 0)
  const totalReal = rows.reduce((s, r) => s + (realByUser.get(r.id) ?? 0), 0)

  // "Empresa en baja" (ver Organization.enBaja) — un ADMIN+ la prende/apaga
  // acá mismo; un vendedor sólo la consulta para decidir si pide (y muestra)
  // el agregado de la empresa, nunca la cambia.
  const { data: enBajaData } = useQuery({
    queryKey: ['organization-en-baja'],
    queryFn: async () => (await fetch('/api/organization/en-baja')).json(),
    staleTime: 60_000,
  })
  const enBaja: boolean = enBajaData?.data?.enBaja ?? false
  const [savingEnBaja, setSavingEnBaja] = useState(false)

  const toggleEnBaja = async () => {
    setSavingEnBaja(true)
    try {
      const res = await fetch('/api/organization/en-baja', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enBaja: !enBaja }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      qc.invalidateQueries({ queryKey: ['organization-en-baja'] })
    } catch { toast.error('Error de conexión') } finally { setSavingEnBaja(false) }
  }

  // Agregado de TODA la empresa — sólo tiene sentido pedirlo para un
  // vendedor no-admin cuando enBaja está prendida (si no, el backend
  // devuelve 403 y no hace falta ni intentarlo); un admin ya ve el agregado
  // real de arriba (totalObjetivo/totalReal calculados de la data completa
  // que ya trae por ser admin).
  const { data: companyData } = useQuery({
    queryKey: ['sales-targets-company', month],
    queryFn: async () => {
      const res = await fetch(`/api/sales-targets?month=${month}&company=1`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !isAdmin && enBaja,
    staleTime: 30_000,
  })
  const companyTotals = companyData?.data as { totalObjetivo: number; totalReal: number } | undefined

  const saveTarget = async (userId: string, raw: string) => {
    const amount = raw.trim() === '' ? 0 : Number(raw)
    if (!Number.isFinite(amount) || amount < 0) { toast.error('Monto inválido'); return }
    setSaving(userId)
    try {
      const res = await fetch('/api/sales-targets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, month, amount, currency: 'USD' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      qc.invalidateQueries({ queryKey: ['sales-targets', month] })
      // El panel de Comisiones (justo debajo en Pipeline) calcula su tramo
      // 10/15/20% a partir de este mismo objetivo — sin esto, quedaba hasta
      // 30s mostrando el % viejo después de guardar un objetivo nuevo.
      qc.invalidateQueries({ queryKey: ['commissions', month] })
    } catch { toast.error('Error de conexión') } finally {
      setSaving(null)
      setEditing((e) => { const n = { ...e }; delete n[userId]; return n })
    }
  }

  if (rows.length === 0 && !isAdmin) return null

  return (
    <div className="rounded-2xl p-4 sm:p-5 space-y-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Target size={16} style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Objetivos de venta</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium capitalize w-32 text-center" style={{ color: 'var(--color-text)' }}>{monthLabel(month)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {isAdmin && (
        <button
          onClick={toggleEnBaja}
          disabled={savingEnBaja}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
          style={enBaja
            ? { borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#ef4444' }
            : { borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          title="Si está prendido, todo el equipo ve el objetivo general de la empresa (no sólo el suyo)"
        >
          <TrendingDown size={12} />
          {enBaja ? 'Empresa en baja — objetivo general visible a todos' : 'Marcar empresa en baja'}
        </button>
      )}

      <div className="flex items-center justify-between text-sm px-1">
        <span style={{ color: 'var(--color-text-muted)' }}>
          {isAdmin ? 'Objetivo general del mes (suma de lo repartido)' : 'Tu objetivo de este mes'}
        </span>
        <span className="font-bold" style={{ color: 'var(--color-text)' }}>
          {formatMoneyExact(totalReal, 'USD')} / {formatMoneyExact(totalObjetivo, 'USD')}
        </span>
      </div>

      {/* Objetivo general de la empresa — sólo para no-admin, y sólo cuando
          Organization.enBaja está prendida (ver comentario arriba). */}
      {!isAdmin && enBaja && companyTotals && (
        <div className="flex items-center justify-between text-sm px-1 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)' }}>
          <span className="flex items-center gap-1.5" style={{ color: '#ef4444' }}>
            <TrendingDown size={13} />
            Objetivo general de la empresa este mes
          </span>
          <span className="font-bold" style={{ color: 'var(--color-text)' }}>
            {formatMoneyExact(companyTotals.totalReal, 'USD')} / {formatMoneyExact(companyTotals.totalObjetivo, 'USD')}
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No hay vendedores/técnicos para repartir objetivos.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const objetivo = targetByUser.get(r.id)?.amount ?? 0
            const real = realByUser.get(r.id) ?? 0
            const pct = objetivo > 0 ? Math.min(100, Math.round((real / objetivo) * 100)) : 0
            const isEditing = editing[r.id] !== undefined
            return (
              <div key={r.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium truncate" style={{ color: 'var(--color-text)' }} title={r.name}>{r.name}</span>
                <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : 'var(--color-primary)' }}
                  />
                </div>
                <span className="w-32 shrink-0 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {formatMoneyExact(real, 'USD')}
                </span>
                {isAdmin ? (
                  <input
                    type="number"
                    min="0"
                    value={isEditing ? editing[r.id] : String(objetivo || '')}
                    placeholder="0"
                    onChange={(e) => setEditing((ed) => ({ ...ed, [r.id]: e.target.value }))}
                    onBlur={(e) => saveTarget(r.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    disabled={saving === r.id}
                    className="w-20 shrink-0 text-right text-xs rounded-lg px-2 py-1 outline-none"
                    style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  />
                ) : (
                  <span className="w-20 shrink-0 text-right text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                    {objetivo > 0 ? formatMoneyExact(objetivo, 'USD') : '—'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
