'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search, MailX } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, Pagination } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'

interface Suppression {
  id:        string
  email:     string
  reason:    string
  createdAt: string
}

const REASON_LABELS: Record<string, string> = {
  unsubscribed: 'Se dio de baja',
}

export default function BajasPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading } = useQuery({
    queryKey: ['suppressions', search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' })
      if (search.length >= 2) p.set('search', search)
      const res = await fetch(`/api/communications/suppressions?${p}`)
      if (!res.ok) throw new Error('Error al cargar bajas')
      return res.json() as Promise<{ data: Suppression[]; total: number; page: number; limit: number; totalPages: number }>
    },
  })

  const rows = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/comunicaciones')}
          className="p-2 rounded-xl hover:bg-[var(--color-surface-raised)] transition-colors"
          style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Bajas de email</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Contactos que se dieron de baja de las campañas — ya no reciben comunicaciones
          </p>
        </div>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Buscar por email..."
          leftIcon={<Search size={15} />}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <Table<Suppression>
        loading={isLoading}
        data={rows}
        emptyMessage={search ? 'Sin resultados para esa búsqueda' : 'Todavía no hay bajas registradas'}
        columns={[
          {
            key: 'email', header: 'Email',
            render: (r) => (
              <span className="flex items-center gap-2">
                <MailX size={14} className="text-[var(--color-text-subtle)]" />
                {r.email}
              </span>
            ),
          },
          {
            key: 'reason', header: 'Motivo',
            render: (r) => <Badge variant="neutral" size="sm">{REASON_LABELS[r.reason] ?? r.reason}</Badge>,
          },
          {
            key: 'createdAt', header: 'Fecha', align: 'right',
            render: (r) => formatDateTime(r.createdAt),
          },
        ]}
      />

      {data && data.totalPages > 1 && (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={setPage} />
      )}
    </div>
  )
}
