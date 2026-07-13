'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Mail, Send, FileText, Users, Calendar, CheckCircle, AlertCircle, Loader, XCircle, ChevronRight, Eye, ShieldAlert, MailX, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { CampaignComposer } from '@/components/communications/campaign-composer'
import { TemplateManager } from '@/components/communications/template-manager'
import { formatDateTime } from '@/lib/utils'
import type { EmailCampaign } from '@/types'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  DRAFT:   { label: 'Borrador', variant: 'neutral' as const, icon: <FileText size={14} /> },
  SENDING: { label: 'Enviando', variant: 'info'    as const, icon: <Loader size={14} className="animate-spin" /> },
  SENT:    { label: 'Enviado',  variant: 'success'  as const, icon: <CheckCircle size={14} /> },
  FAILED:  { label: 'Error',    variant: 'danger'   as const, icon: <AlertCircle size={14} /> },
}

interface CampaignRecipient {
  id: string; email: string; status: string; sentAt: string | null; error: string | null
  deliveredAt?: string | null; bouncedAt?: string | null; spamAt?: string | null
  openedAt?: string | null; openCount?: number
}
interface CampaignDetail extends EmailCampaign {
  recipients: CampaignRecipient[]
}

export default function ComunicacionesPage() {
  const [composerOpen,  setComposerOpen]  = useState(false)
  const [detailId,      setDetailId]      = useState<string | null>(null)
  const [resending,     setResending]     = useState(false)
  const [resendProg,    setResendProg]    = useState<{ sent: number; failed: number; total: number } | null>(null)
  const qc = useQueryClient()

  const handleResend = async (campaignId: string, pendingCount: number) => {
    setResending(true)
    setResendProg({ sent: 0, failed: 0, total: pendingCount })
    let sent = 0, failed = 0, done = false
    try {
      while (!done) {
        const res = await fetch(`/api/communications/campaigns/${campaignId}/send`, { method: 'POST' })
        if (!res.ok) { toast.error('Error al enviar lote'); break }
        const batch = await res.json()
        sent   += batch.sent   ?? 0
        failed += batch.failed ?? 0
        done    = batch.done   ?? false
        setResendProg({ sent, failed, total: pendingCount })
        if (!done) await new Promise(r => setTimeout(r, 300))
      }
      toast.success(`${sent} emails enviados${failed > 0 ? `, ${failed} fallidos` : ''}`)
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['campaign-detail', campaignId] })
    } catch {
      toast.error('Error de conexión')
    } finally {
      setResending(false)
      setResendProg(null)
    }
  }

  const { data: detailData, isLoading: detailLoading } = useQuery<CampaignDetail>({
    queryKey: ['campaign-detail', detailId],
    queryFn:  async () => {
      const res = await fetch(`/api/communications/campaigns/${detailId}`)
      if (!res.ok) throw new Error('Error')
      return (await res.json()).data
    },
    enabled: !!detailId,
  })

  const { data, isLoading, isError } = useQuery<EmailCampaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/communications/campaigns')
      if (!res.ok) throw new Error('Error al cargar campañas')
      return (await res.json()).data ?? []
    },
  })

  const campaigns = data ?? []
  const sent  = campaigns.filter((c) => c.status === 'SENT').length
  const draft = campaigns.filter((c) => c.status === 'DRAFT').length
  const total = campaigns.reduce((acc, c) => acc + (c._count?.recipients ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Comunicaciones</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Campañas masivas y plantillas de email</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setComposerOpen(true)}>Nueva Campaña</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Campañas enviadas', value: sent,            icon: <Send size={18} />,     color: '#22c55e' },
          { label: 'Borradores',        value: draft,           icon: <FileText size={18} />, color: '#f59e0b' },
          { label: 'Emails enviados',   value: total,           icon: <Users size={18} />,    color: 'var(--color-primary)' },
        ].map((stat) => (
          <div key={stat.label} className="surface rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}22`, color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text)]">{stat.value}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Templates section */}
      <div className="surface rounded-2xl p-5">
        <TemplateManager />
      </div>

      {/* Campaign list */}
      <Card padding="none">
        <CardHeader className="p-5 pb-0">
          <CardTitle>Historial de Campañas</CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <AlertCircle size={24} className="text-red-400" />
            <p className="text-sm text-[var(--color-text-muted)]">Error al cargar las campañas</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-raised)] flex items-center justify-center">
              <Mail size={24} className="text-[var(--color-text-subtle)]" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">No hay campañas aún</p>
            <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => setComposerOpen(true)}>
              Crear primera campaña
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {campaigns.map((campaign) => {
              const config = STATUS_CONFIG[campaign.status]
              return (
                <div key={campaign.id}
                  onClick={() => setDetailId(campaign.id)}
                  className="list-appear flex items-center gap-4 p-5 hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white shrink-0">
                    <Mail size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-text)] truncate">{campaign.name}</p>
                    <p className="text-sm text-[var(--color-text-muted)] truncate">{campaign.subject}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 shrink-0 flex-wrap justify-end">
                    <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                      <Users size={14} />{campaign._count?.recipients ?? 0}
                    </div>
                    {/* Tracking stats — visible after SES migration */}
                    {(campaign.totalDelivered ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-emerald-400" title="Entregados">
                        <CheckCircle size={12} />{campaign.totalDelivered}
                      </div>
                    )}
                    {(campaign.totalBounced ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-red-400" title="Rebotados">
                        <MailX size={12} />{campaign.totalBounced}
                      </div>
                    )}
                    {(campaign.totalOpened ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-blue-400" title="Abiertos">
                        <Eye size={12} />{campaign.totalOpened}
                      </div>
                    )}
                    {(campaign.totalSpam ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-amber-400" title="Spam">
                        <ShieldAlert size={12} />{campaign.totalSpam}
                      </div>
                    )}
                    {campaign.sentAt && (
                      <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                        <Calendar size={14} />{formatDateTime(campaign.sentAt)}
                      </div>
                    )}
                  </div>
                  <Badge variant={config.variant}>
                    <span className="flex items-center gap-1.5">{config.icon}{config.label}</span>
                  </Badge>
                  <ChevronRight size={14} className="text-[var(--color-text-subtle)] shrink-0" />
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title="Nueva Campaña de Email" size="xl">
        <CampaignComposer
          onSuccess={() => { setComposerOpen(false); qc.invalidateQueries({ queryKey: ['campaigns'] }) }}
          onCancel={() => setComposerOpen(false)}
        />
      </Modal>

      {/* Campaign detail modal */}
      <Modal open={!!detailId} onClose={() => { if (!resending) setDetailId(null) }} title="Detalle de campaña" size="lg">
        {detailLoading || !detailData ? (
          <div className="flex items-center justify-center py-10 gap-2 text-[var(--color-text-muted)]">
            <Loader size={16} className="animate-spin" /> Cargando...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            {(() => {
              const pendingCount   = detailData.recipients.filter(r => r.status === 'pending').length
              const sentCount      = detailData.recipients.filter(r => r.status === 'sent' || r.status === 'bounced' || r.status === 'spam').length
              const failedCount    = detailData.recipients.filter(r => r.status === 'failed').length
              const deliveredCount = detailData.recipients.filter(r => r.deliveredAt).length
              const openedCount    = detailData.recipients.filter(r => r.openedAt).length
              const bouncedCount   = detailData.recipients.filter(r => r.bouncedAt || r.status === 'bounced').length
              const spamCount      = detailData.recipients.filter(r => r.spamAt    || r.status === 'spam').length
              const hasSesTracking = deliveredCount > 0 || bouncedCount > 0 || openedCount > 0 || spamCount > 0
              const stats = [
                { label: 'Enviados',    value: sentCount,      color: 'text-emerald-400' },
                { label: 'Fallidos',    value: failedCount,    color: 'text-red-400' },
                { label: 'Pendientes',  value: pendingCount,   color: 'text-amber-400' },
                ...(hasSesTracking ? [
                  { label: 'Entregados', value: deliveredCount, color: 'text-teal-400' },
                  { label: 'Abiertos',   value: openedCount,    color: 'text-blue-400' },
                  { label: 'Rebotados',  value: bouncedCount,   color: 'text-orange-400' },
                  { label: 'Spam',       value: spamCount,      color: 'text-yellow-400' },
                ] : []),
              ]
              return (
                <>
                  <div className={`grid gap-3 ${hasSesTracking ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    {stats.map(s => (
                      <div key={s.label} className="surface-raised rounded-xl p-3 text-center">
                        <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Resend section */}
                  {pendingCount > 0 && (
                    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                      {resending && resendProg ? (
                        <>
                          <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            <span>Enviando... {resendProg.sent + resendProg.failed} de {resendProg.total}</span>
                            <span>{resendProg.sent} enviados · {resendProg.failed} fallidos</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.round(((resendProg.sent + resendProg.failed) / resendProg.total) * 100)}%`,
                                background: 'var(--color-primary)',
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {pendingCount} email{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} sin enviar
                          </p>
                          <Button
                            size="sm"
                            leftIcon={<Send size={14} />}
                            onClick={() => handleResend(detailData.id, pendingCount)}
                          >
                            Reenviar pendientes
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

            {/* Recipient list */}
            <div className="rounded-xl overflow-hidden max-h-72 overflow-y-auto" style={{ border: '1px solid var(--color-border)' }}>
              {detailData.recipients.map(r => {
                const Icon = r.openedAt     ? Eye
                           : r.deliveredAt  ? CheckCircle
                           : r.status === 'bounced' || r.bouncedAt ? MailX
                           : r.status === 'spam'    || r.spamAt    ? ShieldAlert
                           : r.status === 'sent'    ? Mail
                           : r.status === 'failed'  ? XCircle
                           : Clock
                const iconColor = r.openedAt     ? 'text-blue-400'
                                : r.deliveredAt  ? 'text-teal-400'
                                : r.status === 'bounced' || r.bouncedAt ? 'text-orange-400'
                                : r.status === 'spam'    || r.spamAt    ? 'text-yellow-400'
                                : r.status === 'sent'    ? 'text-emerald-400'
                                : r.status === 'failed'  ? 'text-red-400'
                                : 'text-amber-400'
                const iconTitle = r.openedAt     ? `Abierto${(r.openCount ?? 0) > 1 ? ` (${r.openCount}×)` : ''}`
                                : r.deliveredAt  ? 'Entregado'
                                : r.status === 'bounced' || r.bouncedAt ? 'Rebotado'
                                : r.status === 'spam'    || r.spamAt    ? 'Marcado como spam'
                                : r.status === 'sent'    ? 'Enviado'
                                : r.status === 'failed'  ? 'Falló'
                                : 'Pendiente'
                return (
                <div key={r.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                  <span title={iconTitle}>
                    <Icon size={14} className={`${iconColor} mt-0.5 shrink-0 ${r.status === 'pending' ? 'animate-spin' : ''}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{r.email}</p>
                    {r.error && <p className="text-xs mt-0.5 text-red-400 break-words">{r.error}</p>}
                    {r.sentAt && !r.error && <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(r.sentAt)}</p>}
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
