import { prisma } from '@/lib/db'
import { UnsubscribeConfirm } from '@/components/unsubscribe/unsubscribe-confirm'
import { MailX } from 'lucide-react'

export const dynamic = 'force-dynamic'

function InvalidShell() {
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
          background: 'rgba(148,163,184,0.12)', color: 'var(--color-text-muted)',
        }}>
          <MailX size={26} />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>Enlace inválido</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
          Este enlace de baja no es válido o ya expiró. Si seguís recibiendo correos que no querés, respondé a alguno de ellos para que lo resolvamos manualmente.
        </p>
      </div>
    </div>
  )
}

// Sólo LEE — la baja real (suppressEmail) vive en
// POST /api/unsubscribe/[recipientId], disparada por un click explícito en
// <UnsubscribeConfirm>, nunca por cargar esta página. Antes esto mutaba en
// el propio render del Server Component (efectivamente "en un GET"), lo que
// hacía que escáneres de enlaces (Safe Links, antiphishing de gateway de
// correo, previews de Slack/WhatsApp) dieran de baja gente sin que nadie
// hubiera abierto el mail.
export default async function UnsubscribePage({ params }: { params: { recipientId: string } }) {
  const db = prisma as any
  const recipient = await db.campaignRecipient.findUnique({
    where:  { id: params.recipientId },
    select: {
      email: true,
      campaign: { select: { organization: { select: { name: true, crmName: true } } } },
    },
  })

  if (!recipient) return <InvalidShell />

  const orgName = recipient.campaign.organization?.name || recipient.campaign.organization?.crmName || 'esta organización'

  return <UnsubscribeConfirm recipientId={params.recipientId} email={recipient.email} orgName={orgName} />
}
