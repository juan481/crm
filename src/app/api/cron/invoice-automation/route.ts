import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { isPluginEnabled } from '@/lib/plugins'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

export const dynamic = 'force-dynamic'

const JOB_NAME = 'invoice-automation'

// Corre el primer día de cada mes (vercel.json). Sólo actúa sobre
// organizaciones que activaron el plugin "Facturación Automática" — el
// resto sigue usando el botón manual "Generar del Mes" en Facturación,
// exactamente igual que hoy. Misma lógica de selección que ese botón
// (POST /api/invoices/generate-recurring): empresas cliente con
// monthlyAmount > 0 que todavía no tienen factura este mes.
//
// A propósito NO manda la factura por mail al cliente — no hay todavía un
// campo de "mail de facturación" por empresa, y automatizar el primer
// contacto de cobro con un cliente real sin que nadie lo revise es un
// riesgo mayor que el beneficio. En cambio manda un resumen a
// ADMIN/SUPER_ADMIN de lo que se generó, mismo patrón que los otros
// digests (task-reminders, attendance-digest) — la persona sigue siendo
// quien decide si hace falta avisarle al cliente.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthName = now.toLocaleString('es', { month: 'long', year: 'numeric' })
    const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 5)

    const orgs = await prisma.organization.findMany({
      select: {
        id: true, name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })

    let orgsSkippedDisabled = 0
    let orgsSkippedAlreadySent = 0
    let orgsWithNothingToBill = 0
    let invoicesCreated = 0
    const wouldCreate: { org: string; empresa: string; amount: number; currency: string }[] = []

    for (const org of orgs) {
      if (!(await isPluginEnabled(org.id, 'invoice-automation'))) { orgsSkippedDisabled++; continue }

      const billableEmpresas = await prisma.empresa.findMany({
        where: { organizationId: org.id, isCliente: true, monthlyAmount: { gt: 0 } },
        select: { id: true, name: true, monthlyAmount: true, billingCurrency: true },
      })
      if (billableEmpresas.length === 0) { orgsWithNothingToBill++; continue }

      const existingInvoices = await prisma.invoice.findMany({
        where: {
          empresaId: { in: billableEmpresas.map((e) => e.id) },
          createdAt: { gte: startOfMonth, lt: endOfMonth },
        },
        select: { empresaId: true },
      })
      const alreadyBilledIds = new Set(existingInvoices.map((i) => i.empresaId))
      const pending = billableEmpresas.filter((e) => !alreadyBilledIds.has(e.id))
      if (pending.length === 0) { orgsWithNothingToBill++; continue }

      if (dryRun) {
        for (const e of pending) {
          wouldCreate.push({ org: org.name || org.crmName || 'CRM', empresa: e.name, amount: e.monthlyAmount ?? 0, currency: e.billingCurrency || 'USD' })
        }
        continue
      }

      // Idempotencia: ya se generó la tanda de este mes para esta org
      // (reintento de Vercel, o disparo manual duplicado) — no se genera de
      // nuevo. Ver modelo CronRun.
      if (!(await claimCronRun(JOB_NAME, org.id, startOfMonth))) { orgsSkippedAlreadySent++; continue }

      const invoices = await prisma.$transaction(
        pending.map((e) =>
          prisma.invoice.create({
            data: {
              empresaId: e.id,
              organizationId: org.id,
              amount: e.monthlyAmount ?? 0,
              currency: e.billingCurrency || 'USD',
              description: `Facturación recurrente — ${monthName}`,
              dueDate,
              status: 'PENDING' as const,
            },
          })
        )
      )
      invoicesCreated += invoices.length

      if (isOrgEmailConfigured(org)) {
        try {
          const staff = await prisma.user.findMany({
            where: { organizationId: org.id, status: 'ACTIVE', role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
            select: { email: true },
          })
          const orgName = org.name || org.crmName || 'CRM'
          const lines = pending.map((e) => `• ${e.name} — ${e.billingCurrency || 'USD'} ${(e.monthlyAmount ?? 0).toLocaleString('es-AR')}`).join('\n')
          const html = buildEmailHtml(
            `${invoices.length} factura${invoices.length !== 1 ? 's' : ''} generada${invoices.length !== 1 ? 's' : ''} automáticamente`,
            `Facturación recurrente de ${monthName}:\n\n${lines}\n\nQuedaron en estado "Pendiente" — entrá a Facturación para revisarlas antes de avisarle a cada cliente.`,
            orgName,
            org.primaryColor || '#6366f1',
            org.secondaryColor || '#8b5cf6',
          )
          for (const s of staff) {
            if (!s.email) continue
            await sendEmail({
              to: s.email,
              subject: `${invoices.length} factura${invoices.length !== 1 ? 's' : ''} generada${invoices.length !== 1 ? 's' : ''} — ${monthName} — ${orgName}`,
              html,
              smtpConfig: resolveOrgSmtpConfig(org),
            })
          }
        } catch (err) {
          console.error('[CRON INVOICE-AUTOMATION] Aviso a staff falló:', err)
        }
      }
    }

    return NextResponse.json({
      ok: true, dryRun, month: monthName,
      invoicesCreated, orgsSkippedDisabled, orgsSkippedAlreadySent, orgsWithNothingToBill, orgsProcessed: orgs.length,
      ...(dryRun ? { wouldCreate } : {}),
    })
  } catch (error) {
    console.error('[CRON INVOICE-AUTOMATION]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
