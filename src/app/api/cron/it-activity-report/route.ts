import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { resolveNotification } from '@/lib/notifications'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { argentinaDayStart } from '@/lib/timezone'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOB_NAME = 'it-activity-report'

// Categorías de ticket que cuentan como "soporte IT".
const IT_CATEGORIES = ['SOPORTE', 'BUG']
const OPEN_STATUSES = ['ABIERTO', 'EN_PROCESO', 'ESPERANDO']

const PRIORITY_LABEL: Record<string, string> = {
  URGENTE: 'URGENTE', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja',
}

// Último día hábil (lun-vie) antes de `from`. Igual que en attendance-digest:
// el cron corre lun-vie, así que el lunes esto da el viernes anterior y la
// ventana [viernes 00:00, lunes 00:00) cubre también sábado y domingo.
function lastBusinessDay(from: Date): Date {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() - 1)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
  return d
}

// Reporte diario de soporte técnico. Opt-in: sólo sale para organizaciones que
// lo activaron en /configuracion/notificaciones (fila NotificationSetting
// type='it-activity'). Nunca lo dispara un usuario, sólo Vercel Cron.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const db = prisma as any
    const now = new Date()
    const until = argentinaDayStart(now)        // hoy 00:00 (Argentina)
    const since = lastBusinessDay(until)        // último día hábil 00:00
    const claimDate = until

    const orgs = await db.organization.findMany({
      select: {
        id: true, name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })

    let emailsSent = 0
    let orgsSkippedDisabled = 0
    let orgsSkippedNoEmail = 0
    let orgsSkippedNoRecipients = 0
    let orgsWithNothingToReport = 0
    let orgsSkippedAlreadySent = 0
    const wouldSend: { org: string; email: string; nuevos: number; backlog: number }[] = []

    for (const org of orgs) {
      const notif = await resolveNotification(org.id, 'it-activity')
      // Sin configurar o apagado → no se manda (feature nueva, opt-in).
      if (!notif.configured || !notif.enabled) { orgsSkippedDisabled++; continue }
      if (notif.emails.length === 0) { orgsSkippedNoRecipients++; continue }
      if (!isOrgEmailConfigured(org)) { orgsSkippedNoEmail++; continue }

      const baseWhere = { organizationId: org.id, category: { in: IT_CATEGORIES } }

      const [nuevos, resueltos, abiertos, calificados] = await Promise.all([
        db.ticket.findMany({
          where: { ...baseWhere, createdAt: { gte: since, lt: until } },
          select: {
            number: true, title: true, priority: true,
            empresa: { select: { name: true } },
            assignedTo: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        db.ticket.findMany({
          where: { ...baseWhere, resolvedAt: { gte: since, lt: until } },
          select: { number: true, title: true, assignedTo: { select: { name: true } } },
          orderBy: { resolvedAt: 'asc' },
        }),
        db.ticket.findMany({
          where: { ...baseWhere, status: { in: OPEN_STATUSES } },
          select: {
            number: true, title: true, priority: true, status: true,
            assignedToId: true, slaDueAt: true,
            empresa: { select: { name: true } },
          },
        }),
        db.ticket.findMany({
          where: { ...baseWhere, satisfactionRatedAt: { gte: since, lt: until } },
          select: { number: true, satisfactionRating: true, satisfactionComment: true },
          orderBy: { satisfactionRatedAt: 'asc' },
        }),
      ])

      const sinAsignar = abiertos.filter((t: any) => !t.assignedToId)
      const vencidosSla = abiertos.filter((t: any) => t.slaDueAt && new Date(t.slaDueAt) < now)
      const enProceso = abiertos.filter((t: any) => t.status === 'EN_PROCESO' || t.status === 'ESPERANDO')
      const backlog = abiertos.length

      const hayNovedades =
        nuevos.length > 0 || resueltos.length > 0 || calificados.length > 0 ||
        sinAsignar.length > 0 || vencidosSla.length > 0 || backlog > 0
      if (!hayNovedades) { orgsWithNothingToReport++; continue }

      if (!dryRun && !(await claimCronRun(JOB_NAME, org.id, claimDate))) { orgsSkippedAlreadySent++; continue }

      const sameDay = since.getTime() === new Date(until.getTime() - 86400000).getTime()
      const rangeLabel = sameDay
        ? since.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
        : `${since.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} al ${new Date(until.getTime() - 86400000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`

      const ticketLine = (t: any, withWho = false) => {
        const parts = [`#${t.number} · ${t.title}`]
        if (t.priority) parts.push(PRIORITY_LABEL[t.priority] ?? t.priority)
        if (t.empresa?.name) parts.push(t.empresa.name)
        if (withWho) parts.push(t.assignedTo?.name ? `→ ${t.assignedTo.name}` : 'sin asignar')
        return '  ' + parts.join(' · ')
      }

      const blocks: string[] = []
      blocks.push(`NUEVOS (${nuevos.length})` + (nuevos.length ? '\n' + nuevos.map((t: any) => ticketLine(t, true)).join('\n') : ''))
      blocks.push(`RESUELTOS (${resueltos.length})` + (resueltos.length ? '\n' + resueltos.map((t: any) => `  #${t.number} · ${t.title}` + (t.assignedTo?.name ? ` · por ${t.assignedTo.name}` : '')).join('\n') : ''))
      if (sinAsignar.length > 0) {
        blocks.push(`⚠️ SIN ASIGNAR (${sinAsignar.length})\n` + sinAsignar.map((t: any) => ticketLine(t)).join('\n'))
      }
      if (vencidosSla.length > 0) {
        blocks.push(`⚠️ VENCIDOS POR SLA (${vencidosSla.length})\n` + vencidosSla.map((t: any) => ticketLine(t)).join('\n'))
      }
      blocks.push(`En proceso / esperando: ${enProceso.length}\nBacklog total abierto: ${backlog}`)
      if (calificados.length > 0) {
        blocks.push(`SATISFACCIÓN (${calificados.length})\n` + calificados.map((t: any) => {
          const stars = '★'.repeat(t.satisfactionRating ?? 0) + '☆'.repeat(Math.max(0, 5 - (t.satisfactionRating ?? 0)))
          return `  #${t.number} · ${stars}` + (t.satisfactionComment ? ` · "${t.satisfactionComment}"` : '')
        }).join('\n'))
      }

      const orgName = org.name || org.crmName || 'CRM'
      const html = buildEmailHtml(
        `Soporte técnico — ${rangeLabel}`,
        blocks.join('\n\n') + '\n\nEntrá a Tickets en el CRM para trabajarlos.',
        orgName,
        org.primaryColor || '#6366f1',
        org.secondaryColor || '#8b5cf6',
      )
      const subject = `Soporte IT ${rangeLabel} — ${nuevos.length} nuevos, ${resueltos.length} resueltos${vencidosSla.length ? `, ${vencidosSla.length} vencidos` : ''} — ${orgName}`

      for (const email of notif.emails) {
        if (dryRun) { wouldSend.push({ org: orgName, email, nuevos: nuevos.length, backlog }); continue }
        try {
          await sendEmail({ to: email, subject, html, smtpConfig: resolveOrgSmtpConfig(org) })
          emailsSent++
        } catch (err) {
          console.error('[CRON IT-ACTIVITY-REPORT] Error enviando a', email, err)
        }
      }
    }

    return NextResponse.json({
      ok: true, dryRun,
      window: { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) },
      emailsSent, orgsSkippedDisabled, orgsSkippedNoEmail, orgsSkippedNoRecipients,
      orgsWithNothingToReport, orgsSkippedAlreadySent, orgsProcessed: orgs.length,
      ...(dryRun ? { wouldSend } : {}),
    })
  } catch (error) {
    console.error('[CRON IT-ACTIVITY-REPORT]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
