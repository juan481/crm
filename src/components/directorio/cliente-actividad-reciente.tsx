'use client'

// Vista 360° del cliente (pedido de Abba, Seba, 2026-10-01): el "Resumen" de
// la ficha sólo mostraba deals activos y tickets — el resto (llamadas,
// reuniones, chat registrado a mano, cotizaciones, y ahora también los chats
// reales de WhatsApp) ya existía en el CRM, pero repartido en otras pestañas.
// Este panel junta las 3 fuentes en una sola línea de tiempo, sin duplicar
// datos: reusa los mismos endpoints que ya consumen EmpresaNotas,
// EmpresaCotizaciones y el inbox de Conversaciones.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  History, FileText, Phone, Video, MessageCircle, Send,
  ClipboardList, Headphones, CheckCircle2, Clock,
} from 'lucide-react'
import { timeAgo, formatMoneyExact } from '@/lib/utils'

type NotaTipo = 'NOTA' | 'LLAMADA' | 'REUNION' | 'CHAT' | 'ENVIO_COTIZACION' | 'CONVERSACION' | 'SOPORTE'

const NOTA_META: Record<NotaTipo, { label: string; icon: React.ReactNode; color: string }> = {
  NOTA:             { label: 'Nota',        icon: <FileText size={13} />,      color: 'var(--color-primary)' },
  LLAMADA:          { label: 'Llamada',     icon: <Phone size={13} />,         color: '#10b981' },
  REUNION:          { label: 'Reunión',     icon: <Video size={13} />,         color: '#a855f7' },
  CHAT:             { label: 'Chat',        icon: <MessageCircle size={13} />, color: '#14b8a6' },
  ENVIO_COTIZACION: { label: 'Cotización',  icon: <Send size={13} />,          color: '#f59e0b' },
  CONVERSACION:     { label: 'Conversación',icon: <ClipboardList size={13} />, color: '#3b82f6' },
  SOPORTE:          { label: 'Soporte',     icon: <Headphones size={13} />,    color: '#ef4444' },
}

interface Item {
  id: string
  date: string
  icon: React.ReactNode
  color: string
  title: string
  subtitle: string
  onClick?: () => void
}

export function ClienteActividadReciente({ empresaId, onVerActividad, onVerCotizaciones }: {
  empresaId: string
  onVerActividad: () => void
  onVerCotizaciones: () => void
}) {
  const router = useRouter()

  const { data: notasData } = useQuery({
    queryKey: ['empresa-notas', empresaId],
    queryFn: async () => {
      const res = await fetch(`/api/empresas/${empresaId}/notas`)
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 60_000,
  })

  const { data: cotizData } = useQuery({
    queryKey: ['cotizaciones-empresa', empresaId],
    queryFn: async () => {
      const res = await fetch(`/api/cotizaciones?empresaId=${empresaId}&limit=20`)
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 60_000,
  })

  // Chats reales de WhatsApp (NISSI) vinculados a esta empresa — distinto del
  // registro manual "CHAT" de EmpresaNota. Si el rol no tiene el módulo
  // Conversaciones habilitado, el fetch devuelve 403 y esta sección queda
  // vacía sin romper el resto del resumen.
  const { data: chatsData } = useQuery({
    queryKey: ['conversaciones-empresa', empresaId],
    queryFn: async () => {
      const res = await fetch(`/api/conversaciones?empresaId=${empresaId}&limit=10`)
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 60_000,
  })

  const items = useMemo<Item[]>(() => {
    const notas = (notasData?.data ?? []) as Array<{ id: string; tipo: NotaTipo; content: string; createdAt: string; user: { name: string } }>
    const cotizaciones = (cotizData?.data ?? []) as Array<{ id: string; ref: string; total: number; currency: string; status: string; createdAt: string }>
    const chats = (chatsData?.data ?? []) as Array<{ id: string; displayName: string | null; preview: string; lastMessageAt: string | null }>

    const fromNotas: Item[] = notas.map((n) => {
      const m = NOTA_META[n.tipo] ?? NOTA_META.NOTA
      return {
        id: `nota-${n.id}`, date: n.createdAt, icon: m.icon, color: m.color,
        title: `${m.label} · ${n.user?.name ?? ''}`.trim(),
        subtitle: n.content,
        onClick: onVerActividad,
      }
    })

    const fromCotizaciones: Item[] = cotizaciones.map((c) => ({
      id: `cot-${c.id}`, date: c.createdAt, icon: <FileText size={13} />, color: '#f59e0b',
      title: `Cotización ${c.ref}`,
      subtitle: `${formatMoneyExact(c.total, c.currency)} · ${c.status}`,
      onClick: onVerCotizaciones,
    }))

    const fromChats: Item[] = chats
      .filter((c) => c.lastMessageAt)
      .map((c) => ({
        id: `chat-${c.id}`, date: c.lastMessageAt as string, icon: <MessageCircle size={13} />, color: '#25D366',
        title: `WhatsApp${c.displayName ? ` · ${c.displayName}` : ''}`,
        subtitle: c.preview || 'Sin mensajes',
        onClick: () => router.push(`/conversaciones?id=${c.id}`),
      }))

    return [...fromNotas, ...fromCotizaciones, ...fromChats]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)
  }, [notasData, cotizData, chatsData, onVerActividad, onVerCotizaciones, router])

  return (
    <div className="rounded-2xl p-4 space-y-3 lg:col-span-2" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2">
        <History size={15} style={{ color: 'var(--color-primary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Actividad reciente</h3>
      </div>

      {items.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Todavía no hay llamadas, reuniones, chats o cotizaciones registradas.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              onClick={it.onClick}
              className={`flex items-start gap-2.5 ${it.onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${it.color}20`, color: it.color }}
              >
                {it.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{it.title}</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{it.subtitle}</p>
              </div>
              <span className="text-[10px] shrink-0 flex items-center gap-1" style={{ color: 'var(--color-text-subtle)' }}>
                <Clock size={9} />{timeAgo(it.date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
