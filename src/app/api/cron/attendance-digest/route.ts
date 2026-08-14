import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { isPluginEnabled } from '@/lib/plugins'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { argentinaDayStart } from '@/lib/timezone'

const JOB_NAME = 'attendance-digest'

export const dynamic = 'force-dynamic'

// Último día hábil (lun-vie) antes de `from` — con vercel.json corriendo
// este cron sólo de lunes a viernes, esto siempre da el día correcto sin
// duplicar ni saltear ninguno (lunes → viernes anterior, martes → lunes...).
// `from` tiene que ser ya una medianoche UTC que representa un día
// argentino (ver argentinaDayStart) — de acá para atrás es aritmética de
// días calendario pura en UTC, sin pasar por los getters/setters "locales"
// de Date (que en Vercel resuelven como UTC, no Argentina).
function lastBusinessDay(from: Date): Date {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() - 1)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
  return d
}

// Aviso diario a RRHH/Admin de quién no fichó o llegó tarde el último día
// hábil — a propósito NO crea ninguna fila de Asistencia (marcar ausente
// sigue siendo 100% manual, alguien pudo avisar y todavía no cargarlo). Ver
// Fase 12 del plan. Disparado por Vercel Cron, nunca por un usuario.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Modo prueba: ver comentario equivalente en task-reminders/route.ts —
  // mismas queries, sin mandar mail real ni reclamar el CronRun del día.
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const db = prisma as any
    const target = lastBusinessDay(argentinaDayStart())

    const [users, records, orgs] = await Promise.all([
      db.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, role: true, organizationId: true },
      }),
      db.asistencia.findMany({
        where: { fecha: target },
        select: { userId: true, ausente: true, tardanza: true },
      }),
      db.organization.findMany({
        select: {
          id: true, name: true, crmName: true, primaryColor: true, secondaryColor: true,
          smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
          smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
        },
      }),
    ])

    const recordByUser = new Map<string, { ausente: boolean; tardanza: boolean }>()
    for (const r of records) recordByUser.set(r.userId, r)

    const usersByOrg = new Map<string, typeof users>()
    for (const u of users) {
      if (!usersByOrg.has(u.organizationId)) usersByOrg.set(u.organizationId, [])
      usersByOrg.get(u.organizationId)!.push(u)
    }

    let emailsSent = 0
    let orgsWithNothingToReport = 0
    let orgsSkippedNoEmail = 0
    let orgsSkippedAlreadySent = 0
    let orgsSkippedDisabled = 0
    const wouldSend: { org: string; email: string }[] = []

    for (const org of orgs) {
      // Plugin "attendance-alerts" — apagado por defecto para toda
      // organización que nunca lo tocó (PluginConfig sin fila = enabled:
      // false, ver /api/plugins). Antes este aviso salía siempre, sin
      // forma de pausarlo por organización.
      if (!(await isPluginEnabled(org.id, 'attendance-alerts'))) { orgsSkippedDisabled++; continue }

      const orgUsers = usersByOrg.get(org.id) ?? []
      const sinFichar = orgUsers.filter((u: any) => !recordByUser.has(u.id))
      const tarde = orgUsers.filter((u: any) => recordByUser.get(u.id)?.tardanza)

      if (sinFichar.length === 0 && tarde.length === 0) { orgsWithNothingToReport++; continue }
      if (!isOrgEmailConfigured(org)) { orgsSkippedNoEmail++; continue }

      // Idempotencia: si ya se mandó el digest de este día hábil para esta
      // org (reintento de Vercel, o disparo manual duplicado), no se manda
      // de nuevo — ver modelo CronRun. En dry run no se reclama nada.
      if (!dryRun && !(await claimCronRun(JOB_NAME, org.id, target))) { orgsSkippedAlreadySent++; continue }

      const recipients = orgUsers.filter((u: any) => ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(u.role))
      const recipientUsers = await db.user.findMany({
        where: { id: { in: recipients.map((u: any) => u.id) } },
        select: { email: true },
      })
      const emails: string[] = recipientUsers.map((u: any) => u.email).filter(Boolean)
      if (emails.length === 0) continue

      const dateLabel = target.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      const lines = [
        sinFichar.length > 0 ? `No ficharon (${sinFichar.length}): ${sinFichar.map((u: any) => u.name).join(', ')}` : null,
        tarde.length > 0 ? `Llegaron tarde (${tarde.length}): ${tarde.map((u: any) => u.name).join(', ')}` : null,
      ].filter(Boolean).join('\n\n')

      const orgName = org.name || org.crmName || 'CRM'
      const html = buildEmailHtml(
        `Asistencia del ${dateLabel}`,
        `${lines}\n\nMarcar una ausencia sigue siendo manual — entrá a RRHH en el CRM si corresponde.`,
        orgName,
        org.primaryColor || '#6366f1',
        org.secondaryColor || '#8b5cf6',
      )

      // sendEmail() no soporta CC/múltiples destinatarios en un solo envío
      // (ver src/lib/email.ts) — se manda uno por persona, mismo patrón que
      // el resto de la app (siempre 1 destinatario por sendEmail()).
      for (const email of emails) {
        if (dryRun) {
          wouldSend.push({ org: orgName, email })
          continue
        }
        try {
          await sendEmail({
            to: email,
            subject: `Asistencia ${dateLabel} — ${sinFichar.length} sin fichar, ${tarde.length} tarde`,
            html,
            smtpConfig: resolveOrgSmtpConfig(org),
          })
          emailsSent++
        } catch (err) {
          console.error('[CRON ATTENDANCE-DIGEST] Error enviando a', email, err)
        }
      }
    }

    return NextResponse.json({
      ok: true, dryRun, target: target.toISOString().slice(0, 10),
      emailsSent, orgsWithNothingToReport, orgsSkippedNoEmail, orgsSkippedAlreadySent, orgsSkippedDisabled, orgsProcessed: orgs.length,
      ...(dryRun ? { wouldSend } : {}),
    })
  } catch (error) {
    console.error('[CRON ATTENDANCE-DIGEST]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
