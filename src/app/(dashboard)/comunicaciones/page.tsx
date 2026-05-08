'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Mail, Send, FileText, Users, Calendar, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { CampaignComposer } from '@/components/communications/campaign-composer'
import { formatDateTime } from '@/lib/utils'
import type { EmailCampaign } from '@/types'

const STATUS_CONFIG = {
  DRAFT: { label: 'Borrador', variant: 'neutral' as const, icon: <FileText size={14} /> },
  SENDING: { label: 'Enviando', variant: 'info' as const, icon: <Loader size={14} className="animate-spin" /> },
  SENT: { label: 'Enviado', variant: 'success' as const, icon: <CheckCircle size={14} /> },
  FAILED: { label: 'Error', variant: 'danger' as const, icon: <AlertCircle size={14} /> },
}

export default function ComunicacionesPage() {
  const [composerOpen, setComposerOpen] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/communications/campaigns')
      const json = await res.json()
      return json.data
    },
  })

  const campaigns = data ?? []
  const sent = campaigns.filter((c) => c.status === 'SENT').length
  const draft = campaigns.filter((c) => c.status === 'DRAFT').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Comunicaciones</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Gestión de emails y campañas masivas</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setComposerOpen(true)}>Nueva Campaña</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Campañas', value: campaigns.length, icon: <Mail size={18} />, color: 'var(--color-primary)' },
          { label: 'Enviadas', value: sent, icon: <Send size={18} />, color: '#22c55e' },
          { label: 'Borradores', value: draft, icon: <FileText size={18} />, color: '#f59e0b' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="surface rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: `${stat.color}33`, color: stat.color }}>{stat.icon}</div>
            <div><p className="text-xl font-bold text-[var(--color-text)]">{stat.value}</p><p className="text-sm text-[var(--color-text-muted)]">{stat.label}</p></div>
          </motion.div>
        ))}
      </div>

      <Card padding="none">
        <CardHeader className="p-5 pb-0"><CardTitle>Campañas de Email</CardTitle></CardHeader>
        {isLoading ? (
          <div className="p-5 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-raised)] flex items-center justify-center"><Mail size={24} className="text-[var(--color-text-subtle)]" /></div>
            <p className="text-sm text-[var(--color-text-muted)]">No hay campañas aún</p>
            <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => setComposerOpen(true)}>Crear primera campaña</Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {campaigns.map((campaign, i) => {
              const config = STATUS_CONFIG[campaign.status]
              return (
                <motion.div key={campaign.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-4 p-5 hover:bg-[var(--color-surface-raised)] transition-colors">
                  <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white shrink-0"><Mail size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-text)] truncate">{campaign.name}</p>
                    <p className="text-sm text-[var(--color-text-muted)] truncate">{campaign.subject}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"><Users size={14} />{campaign._count?.recipients ?? 0} destinatarios</div>
                    {campaign.sentAt && <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"><Calendar size={14} />{formatDateTime(campaign.sentAt)}</div>}
                  </div>
                  <Badge variant={config.variant}><span className="flex items-center gap-1.5">{config.icon}{config.label}</span></Badge>
                </motion.div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title="Nueva Campaña de Email" size="xl">
        <CampaignComposer onSuccess={() => { setComposerOpen(false); qc.invalidateQueries({ queryKey: ['campaigns'] }) }} onCancel={() => setComposerOpen(false)} />
      </Modal>
    </div>
  )
}
