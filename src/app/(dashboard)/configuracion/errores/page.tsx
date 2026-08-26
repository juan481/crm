'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, AlertTriangle, ChevronDown, ChevronUp, Bug } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/utils'

interface ErrorLogRow {
  id: string
  code: string
  message: string
  stack: string | null
  componentStack: string | null
  url: string | null
  userEmail: string | null
  userAgent: string | null
  createdAt: string
}

// Errores reales que atrapó el ErrorBoundary (components/ui/error-boundary.tsx)
// — cada uno con un código corto que la persona que lo vio en pantalla
// puede pasar por WhatsApp, sin necesitar abrir la consola del navegador.
// Buscar acá por ese código muestra el mensaje, el stack completo, en qué
// URL pasó y quién estaba logueado.
export default function ErroresPage() {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const code = search.trim()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['error-logs', code],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (code) p.set('code', code)
      const res = await fetch(`/api/errors?${p}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar')
      return json.data
    },
  })

  // La API devuelve un objeto solo (no array) cuando se busca por código
  // puntual — se normaliza acá para que el render de abajo sea siempre una
  // lista, sin dos ramas de JSX distintas.
  const rows: ErrorLogRow[] = Array.isArray(data) ? data : data ? [data] : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center"><Bug size={18} className="text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Errores</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Buscá por el código que te pasaron, o mirá los últimos que aparecieron solos
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
        <Input
          placeholder="Código de error (ej: 3F9K2A1B)..."
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          className="pl-9 font-mono"
        />
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle size={28} className="mb-3 opacity-40" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {code ? `No se encontró ningún error con el código "${code}"` : 'Error al cargar'}
          </p>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-center py-12" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bug size={28} className="mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Sin errores registrados todavía</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const expanded = expandedId === row.id
            return (
              <div key={row.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg shrink-0" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-primary)' }}>
                    {row.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{row.message}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-subtle)' }}>
                      {formatDateTime(row.createdAt)}{row.userEmail ? ` · ${row.userEmail}` : ''}{row.url ? ` · ${row.url}` : ''}
                    </p>
                  </div>
                  {expanded ? <ChevronUp size={16} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />}
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {row.stack && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-subtle)' }}>Stack</p>
                        <pre className="text-xs overflow-auto max-h-64 rounded-xl p-3" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>{row.stack}</pre>
                      </div>
                    )}
                    {row.componentStack && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-subtle)' }}>Componentes</p>
                        <pre className="text-xs overflow-auto max-h-64 rounded-xl p-3" style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>{row.componentStack}</pre>
                      </div>
                    )}
                    {row.userAgent && (
                      <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Navegador: {row.userAgent}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
