import { prisma } from '@/lib/db'
import { suppressEmail } from '@/lib/suppression'
import { MailX, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

function Shell({ ok, title, message }: { ok: boolean; title: string; message: string }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', padding: '24px',
    }}>
      <div style={{
        maxWidth: 420, width: '100%', textAlign: 'center',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 24, padding: '40px 32px',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
          color: ok ? '#10b981' : 'var(--color-text-muted)',
        }}>
          {ok ? <CheckCircle2 size={26} /> : <MailX size={26} />}
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>{message}</p>
      </div>
    </div>
  )
}

export default async function UnsubscribePage({ params }: { params: { recipientId: string } }) {
  const db = prisma as any
  const recipient = await db.campaignRecipient.findUnique({
    where:  { id: params.recipientId },
    select: {
      email: true,
      campaign: { select: { organizationId: true, organization: { select: { name: true, crmName: true } } } },
    },
  })

  if (!recipient) {
    return (
      <Shell ok={false} title="Enlace inválido"
        message="Este enlace de baja no es válido o ya expiró. Si seguís recibiendo correos que no querés, respondé a alguno de ellos para que lo resolvamos manualmente." />
    )
  }

  await suppressEmail(recipient.campaign.organizationId, recipient.email)

  const orgName = recipient.campaign.organization?.name || recipient.campaign.organization?.crmName || 'esta organización'

  return (
    <Shell ok title="Listo, te dimos de baja"
      message={`${recipient.email} no va a recibir más comunicaciones de ${orgName}. Podés cerrar esta ventana.`} />
  )
}
