import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { resolveNotification } from '@/lib/notifications'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { argentinaDayStart } from '@/lib/timezone'
import { TICKET_SIN_ATENDER_HORAS } from '@/lib/tickets'
import { appBaseUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOB_NAME = 'tickets-sin-atender'
const DAY_MS = 24 * 60 * 60 * 1000

// Recordatorio diario de tickets sin atender — pedido de Abba (Seba, 25/10):
// lo que NISSI deriva a Norma/Sergio (polígono, CLU, CVs) "no lo están
// revisando ni gestionando; si puede generar molestia al área, genial,
// porque un día va a llegar algo importante y no le van a dar bola".
//
// Cada persona (asignada o colaboradora) recibe SU lista de tickets que
// siguen en ABIERTO hace más de TICKET_SIN_ATENDER_HORAS — todos los días
// hábiles, hasta que los pase a "En proceso" o los resuelva. Los
// destinatarios configurados en /configuracion/notificaciones (ej. Seba)
// reciben el resumen de todo, incluidos los sin asignar. Opt-in: sólo corre
// para las organizaciones que lo prendieron. Mismo patrón que
// carnet-vencimiento (claimCronRun, ?dryRun=1).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const db = prisma as any
    const today = argentinaDayStart()
    const now = Date.now()
    const base = appBaseUrl()

    const orgs = await db.organization.findMany({
      select: {
        id: true, name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })

    let emailsSent = 0
    const wouldSend: { org: string; email: string; tickets: number }[] = []

    for (const org of orgs) {
      const notif = await resolveNotification(org.id, 'tickets-sin-atender')
      if (!notif.configured || !notif.enabled) continue
      if (!isOrgEmailConfigured(org)) continue

      const tickets = await db.ticket.findMany({
        where: { organizationId: org.id, status: 'ABIERTO', createdAt: { lt: new Date(now - TICKET_SIN_ATENDER_HORAS * 60 * 60 * 1000) } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, number: true, title: true, createdAt: true, category: true,
          assignedTo: { select: { id: true, email: true, name: true, status: true } },
          collaborators: { select: { user: { select: { id: true, email: true, name: true, status: true } } } },
        },
      })
      if (tickets.length === 0) continue
      if (!dryRun && !(await claimCronRun(JOB_NAME, org.id, today))) continue

      const linea = (t: any) => {
        const dias = Math.max(1, Math.floor((now - new Date(t.createdAt).getTime()) / DAY_MS))
        return `• #${t.number} ${t.title} — abierto hace ${dias} día${dias !== 1 ? 's' : ''}${t.assignedTo ? '' : ' (SIN ASIGNAR)'}\n  ${base}/tickets/${t.id}`
      }

      // Por persona: asignado + colaboradores (activos, con email real).
      const porPersona = new Map<string, { name: string; tickets: any[] }>()
      for (const t of tickets) {
        const personas = [t.assignedTo, ...t.collaborators.map((c: any) => c.user)]
          .filter((u: any) => u && u.status === 'ACTIVE' && u.email && !u.email.endsWith('.internal'))
        for (const u of personas) {
          const k = u.email.toLowerCase()
          const row = porPersona.get(k) ?? { name: u.name as string, tickets: [] as any[] }
          row.tickets.push(t)
          porPersona.set(k, row)
        }
      }

      const orgName = org.name || org.crmName || 'CRM'
      const color1 = org.primaryColor || '#6366f1'
      const color2 = org.secondaryColor || '#8b5cf6'
      const envios: { to: string; subject: string; html: string; n: number }[] = []

      for (const [email, p] of Array.from(porPersona)) {
        const n = p.tickets.length
        envios.push({
          to: email, n,
          subject: `Tenés ${n} ticket${n !== 1 ? 's' : ''} sin atender — ${orgName}`,
          html: buildEmailHtml(
            `${p.name ? `${p.name}, tenés` : 'Tenés'} ${n} ticket${n !== 1 ? 's' : ''} sin atender`,
            `Siguen en "Abierto" hace más de un día:\n\n${p.tickets.map(linea).join('\n')}\n\nCuando lo tomes, pasalo a "En proceso" (y a "Resuelto" cuando lo cierres): así deja de llegarte este aviso todos los días.`,
            orgName, color1, color2,
          ),
        })
      }
      // Resumen para los destinatarios configurados (ej. el dueño), sin
      // repetirle el suyo a quien ya recibió su lista personal.
      for (const email of notif.emails) {
        envios.push({
          to: email, n: tickets.length,
          subject: `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} sin atender en total — ${orgName}`,
          html: buildEmailHtml(
            `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} sin atender`,
            `Resumen de todo lo que sigue en "Abierto" hace más de un día (a cada responsable ya le llegó su lista):\n\n${tickets.map((t: any) => `${linea(t)}${t.assignedTo ? `\n  a cargo de ${t.assignedTo.name}` : ''}`).join('\n')}`,
            orgName, color1, color2,
          ),
        })
      }

      for (const e of envios) {
        if (dryRun) { wouldSend.push({ org: orgName, email: e.to, tickets: e.n }); continue }
        try {
          await sendEmail({ to: e.to, subject: e.subject, html: e.html, smtpConfig: resolveOrgSmtpConfig(org) })
          emailsSent++
        } catch (err) {
          console.error('[CRON TICKETS-SIN-ATENDER] Error enviando a', e.to, err)
        }
      }
    }

    return NextResponse.json({ ok: true, dryRun, emailsSent, ...(dryRun ? { wouldSend } : {}) })
  } catch (error) {
    console.error('[CRON TICKETS-SIN-ATENDER]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
