'use client'

// Etiqueta "de la oportunidad X" / "del contacto Y" para las notas que la
// ficha de un cliente o contacto trae de otro lado (ver
// src/lib/historial-cliente.ts) — así se sabe de dónde salió lo hablado y se
// puede ir a verlo. Esas notas no se borran desde acá.

import Link from 'next/link'
import { TrendingUp, UserCircle2 } from 'lucide-react'

export interface NotaOrigen { tipo: 'oportunidad' | 'contacto'; id: string; label: string }

export function NotaOrigenBadge({ origen }: { origen: NotaOrigen }) {
  const esDeal = origen.tipo === 'oportunidad'
  return (
    <Link
      href={esDeal ? `/pipeline?dealId=${origen.id}` : `/contactos/${origen.id}`}
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full max-w-[220px] hover:underline"
      style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}
      title={esDeal ? `Cargado en la oportunidad "${origen.label}"` : `Cargado en el contacto ${origen.label}`}
    >
      {esDeal ? <TrendingUp size={9} className="shrink-0" /> : <UserCircle2 size={9} className="shrink-0" />}
      <span className="truncate">{esDeal ? 'Oportunidad' : 'Contacto'}: {origen.label}</span>
    </Link>
  )
}
