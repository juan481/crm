'use client'

// "Agendar contacto" en el detalle de una oportunidad — pedido de Abba (Seba,
// 25/10): "Sebastián contacta y se pone una agenda para dentro de 3 días; a
// los tres días le aparece que tiene que contactar a Juan". Atajos de un
// toque (mañana / 3 días / 1 semana) o un día a elección, y un "qué hacer"
// opcional. Ese día aparece en la campanita del responsable, en la tarjeta
// del tablero, en Tareas y en el mail diario de tareas.

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { argentinaDayKey, fmtDateOnly } from '@/lib/timezone'
import { sumarDiasDateKey, etiquetaDiaAgenda } from '@/lib/deal-agenda-fechas'
import toast from 'react-hot-toast'

interface Agenda { id: string; title: string; description: string | null; dia: string; asignado: string | null }

const ATAJOS = [
  { dias: 1, label: 'Mañana' },
  { dias: 3, label: 'En 3 días' },
  { dias: 7, label: 'En 1 semana' },
]

export function DealAgenda({ dealId }: { dealId: string }) {
  const qc = useQueryClient()
  const hoy = argentinaDayKey()
  const [fecha, setFecha] = useState(sumarDiasDateKey(hoy, 3))
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cerrandoId, setCerrandoId] = useState<string | null>(null)
  const [resultado, setResultado] = useState('')

  const { data, isLoading } = useQuery<{ data: Agenda[] }>({
    queryKey: ['deal-agenda', dealId],
    queryFn: async () => (await fetch(`/api/deals/${dealId}/agenda`)).json(),
    staleTime: 10_000,
  })
  const agendas = data?.data ?? []

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['deal-agenda', dealId] })
    qc.invalidateQueries({ queryKey: ['deals'] })
    qc.invalidateQueries({ queryKey: ['deal-notas', dealId] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const agendar = async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/deals/${dealId}/agenda`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, nota }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error ?? 'No se pudo agendar'); return }
      toast.success(`Agendado para ${etiquetaDiaAgenda(fecha, hoy).toLowerCase()} — ese día te aparece en la campanita`)
      setNota('')
      refrescar()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const accion = async (a: Agenda, tipo: 'hecho' | 'cancelar') => {
    setBusyId(a.id)
    try {
      const r = await fetch(`/api/deals/${dealId}/agenda/${a.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: tipo, resultado }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error ?? 'No se pudo guardar'); return }
      toast.success(tipo === 'hecho' ? 'Listo — quedó anotado en la Actividad. ¿Agendás el próximo?' : 'Agenda borrada')
      setCerrandoId(null); setResultado('')
      refrescar()
    } catch { toast.error('Error de conexión') } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--color-text-subtle)' }}>
        <CalendarClock size={12} /> Próximo contacto
      </p>

      {!isLoading && agendas.map((a) => {
        const vencida = a.dia < hoy
        const esHoy = a.dia === hoy
        return (
          <div key={a.id} className="rounded-xl px-3 py-2 space-y-2"
            style={{
              border: `1px solid ${vencida ? 'rgba(239,68,68,0.4)' : esHoy ? 'rgba(245,158,11,0.5)' : 'var(--color-border)'}`,
              background: vencida ? 'rgba(239,68,68,0.06)' : esHoy ? 'rgba(245,158,11,0.06)' : undefined,
            }}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: vencida ? '#ef4444' : esHoy ? '#f59e0b' : 'var(--color-text)' }}>
                  {vencida ? `Vencida — era el ${fmtDateOnly(a.dia)}` : etiquetaDiaAgenda(a.dia, hoy)}
                  {a.asignado && <span className="text-[11px] font-normal" style={{ color: 'var(--color-text-subtle)' }}> · {a.asignado}</span>}
                </p>
                {a.description && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{a.description}</p>}
              </div>
              {cerrandoId !== a.id && (
                <>
                  <Button size="sm" onClick={() => { setCerrandoId(a.id); setResultado('') }} leftIcon={<Check size={13} />}>Hecho</Button>
                  <button onClick={() => accion(a, 'cancelar')} disabled={busyId === a.id} title="Borrar esta agenda"
                    className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 disabled:opacity-50">
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
            {cerrandoId === a.id && (
              <div className="flex items-center gap-2">
                <input
                  autoFocus value={resultado} onChange={(e) => setResultado(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') accion(a, 'hecho') }}
                  placeholder="¿Cómo te fue? (opcional) — ej: quedó en pasar el viernes"
                  className="flex-1 text-sm rounded-lg px-3 py-1.5 outline-none"
                  style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
                <Button size="sm" onClick={() => accion(a, 'hecho')} loading={busyId === a.id}>Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => setCerrandoId(null)}>Volver</Button>
              </div>
            )}
          </div>
        )
      })}

      <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="flex flex-wrap items-center gap-1.5">
          {ATAJOS.map((a) => {
            const k = sumarDiasDateKey(hoy, a.dias)
            return (
              <button key={a.dias} type="button" onClick={() => setFecha(k)}
                className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                style={fecha === k
                  ? { background: 'var(--color-primary)', color: '#fff' }
                  : { background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                {a.label}
              </button>
            )
          })}
          <input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value || hoy)}
            className="text-xs rounded-lg px-2 py-1 outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
        </div>
        <div className="flex items-center gap-2">
          <input
            value={nota} onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !saving) agendar() }}
            placeholder="Qué hacer (opcional) — ej: llamar para ver si vio la cotización"
            className="flex-1 text-sm rounded-lg px-3 py-1.5 outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <Button size="sm" onClick={agendar} loading={saving} leftIcon={<CalendarClock size={13} />}>Agendar</Button>
        </div>
      </div>
    </div>
  )
}
