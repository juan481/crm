import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { isPluginEnabled, getPluginConfig } from '@/lib/plugins'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { formatMoneyExact } from '@/lib/utils'
import { argentinaDayStart } from '@/lib/timezone'
import { paymentsEnabledForOrg } from '@/lib/payments/config'

export const dynamic = 'force-dynamic'

const JOB_NAME = 'payment-reminders'
const DAY_MS = 24 * 60 * 60 * 1000

// Corre todos los días (vercel.json). Para cada organización con el plugin
// "invoice-automation" activo y los recordatorios habilitados en su config:
//  1) Marca OVERDUE las facturas PENDING ya vencidas.
//  2) Reenvía el link de pago (email al contacto de facturación) a los N días
//     del vencimiento — por defecto a los 3 y a los 7. Sólo facturas que YA
//     se enviaron una vez (sentAt != null) — no es el primer contacto de
//     cobro, eso lo decide una persona (semi-automático, decisión del user).
//
// Idempotente por CronRun (jobName + org + día): un reintento de Vercel el
// mismo día no reenvía nada.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  try {
    const argToday = argentinaDayStart(new Date())

    const orgs = await prisma.organization.findMany({
      select: {
        id: true, name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })

    let remindersSent = 0
    let markedOverdue = 0
    const wouldSend: { org: string; empresa: string; concepto: string; diasVencida: number }[] = []

    for (const org of orgs) {
      // Candado multi-tenant: sólo orgs habilitadas para cobrar online.
      if (!paymentsEnabledForOrg(org.id)) continue
      if (!(await isPluginEnabled(org.id, 'invoice-automation'))) continue

      const cfg = (await getPluginConfig(org.id, 'invoice-automation')) as
        | { remindersEnabled?: boolean | string; reminderDays?: string } | null
      // OPT-IN a propósito: los recordatorios le mandan un mail AL CLIENTE
      // final, así que ninguna organización que ya tiene el plugin
      // invoice-automation prendido (ej. Abba) empieza a mandarlos sin
      // pedirlo. Se activan poniendo remindersEnabled = "true" en la config
      // del plugin (el seed de Just Create lo hace). PluginConfig.config
      // guarda strings — ver ConfigModal.
      const enabled = cfg?.remindersEnabled === true
        || cfg?.remindersEnabled === 'true'
        || cfg?.remindersEnabled === 'on'
      if (!enabled) continue
      const reminderDays = parseDays(cfg?.reminderDays) ?? [3, 7]

      // 1) PENDING vencidas → OVERDUE
      const overdueRes = await prisma.invoice.updateMany({
        where: { organizationId: org.id, status: 'PENDING', dueDate: { lt: argToday } },
        data: { status: 'OVERDUE' },
      })
      markedOverdue += overdueRes.count

      // 2) Candidatas a recordatorio
      const candidates = await prisma.invoice.findMany({
        where: {
          organizationId: org.id,
          status: { in: ['PENDING', 'OVERDUE'] },
          sentAt: { not: null },
          payToken: { not: null },
          empresaId: { not: null },
        },
        select: { id: true, amount: true, currency: true, description: true, dueDate: true, payToken: true, empresaId: true, numeroInterno: true },
      })

      const due = candidates.filter((inv) => {
        const days = Math.floor((argToday.getTime() - argentinaDayStart(inv.dueDate).getTime()) / DAY_MS)
        return reminderDays.includes(days)
      })
      if (due.length === 0) continue

      if (dryRun) {
        for (const inv of due) {
          const emp = await prisma.empresa.findUnique({ where: { id: inv.empresaId! }, select: { name: true } })
          wouldSend.push({
            org: org.name || org.crmName || 'CRM',
            empresa: emp?.name ?? '—',
            concepto: inv.description ?? 'factura',
            diasVencida: Math.floor((argToday.getTime() - argentinaDayStart(inv.dueDate).getTime()) / DAY_MS),
          })
        }
        continue
      }

      if (!(await claimCronRun(JOB_NAME, org.id, argToday))) continue
      if (!isOrgEmailConfigured(org) || !appUrl) continue

      const orgName = org.name || org.crmName || 'CRM'

      for (const inv of due) {
        const contacto = await prisma.directorioContacto.findFirst({
          where: { organizationId: org.id, empresaId: inv.empresaId!, email: { not: null } },
          orderBy: { createdAt: 'asc' },
          select: { email: true },
        })
        if (!contacto?.email) continue

        const numero = inv.numeroInterno ?? inv.id.slice(-8).toUpperCase()
        const payUrl = `${appUrl}/pagar/${inv.payToken}`
        const accent = org.primaryColor || '#6366f1'
        const html = buildEmailHtml(
          `Recordatorio de pago — Factura ${numero}`,
          `Te recordamos que la factura ${numero} por ${formatMoneyExact(inv.amount, inv.currency)} venció el ${new Date(inv.dueDate).toLocaleDateString('es-AR')} y figura como impaga.\n\n<a href="${payUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;margin:8px 0">Pagar ahora</a>\n\nO copiá este link:\n${payUrl}\n\nSi ya lo pagaste, ignorá este mensaje.\n\n${orgName}`,
          orgName,
          accent,
          org.secondaryColor || '#8b5cf6',
        )
        try {
          await sendEmail({
            to: contacto.email,
            subject: `Recordatorio: factura ${numero} impaga — ${orgName}`,
            html,
            smtpConfig: resolveOrgSmtpConfig(org),
          })
          remindersSent++
        } catch (err) {
          console.error('[CRON PAYMENT-REMINDERS] envío falló:', err)
        }
      }
    }

    return NextResponse.json({ ok: true, dryRun, remindersSent, markedOverdue, ...(dryRun ? { wouldSend } : {}) })
  } catch (error) {
    console.error('[CRON PAYMENT-REMINDERS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

function parseDays(raw: string | undefined): number[] | null {
  if (!raw) return null
  const days = raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0 && n < 90)
  return days.length ? days : null
}
