import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { isPluginEnabled, getPluginConfig } from '@/lib/plugins'
import { billAbonosForOrg, empresasConAbono } from '@/lib/billing-recurrente'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { sendInvoiceEmail } from '@/lib/invoice-email'
import { argentinaDayStart, dateOnlyArgentina } from '@/lib/timezone'

function cfgTrue(v: unknown): boolean {
  return v === true || v === 'true' || v === 'on' || v === '1'
}

export const dynamic = 'force-dynamic'

const JOB_NAME = 'invoice-automation'

// Corre el primer día de cada mes (vercel.json). Sólo actúa sobre
// organizaciones que activaron el plugin "Facturación Automática" — el
// resto sigue usando el botón manual "Generar del Mes" en Facturación,
// exactamente igual que hoy.
//
// Factura dos cosas:
//  1) Abonos (ServicioRecurrente) según su ciclo — ver src/lib/billing-recurrente.ts.
//  2) Empresas cliente con monthlyAmount > 0 que NO tienen ningún abono activo
//     (flujo viejo). Si una empresa tiene abono, su monthlyAmount se ignora
//     para no facturar dos veces.
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
    // Y/M derivados del día calendario ARGENTINA (argentinaDayStart), no de
    // los getters "locales" de `now` (=UTC en Vercel) — y dueDate armado con
    // dateOnlyArgentina para que se muestre como "día 5" en el navegador del
    // usuario, no "día 4" (bug real encontrado: medianoche UTC de un "5"
    // renderiza como "4" en timezone Argentina). Ver src/lib/timezone.ts.
    const argToday = argentinaDayStart(now)
    const y = argToday.getUTCFullYear()
    const m = argToday.getUTCMonth()
    const startOfMonth = new Date(Date.UTC(y, m, 1))
    const endOfMonth = new Date(Date.UTC(y, m + 1, 1))
    const monthName = now.toLocaleString('es', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
    const dueDate = dateOnlyArgentina(y, m + 1, 5)

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
    const wouldCreate: { org: string; empresa: string; concepto: string; amount: number; currency: string }[] = []

    for (const org of orgs) {
      if (!(await isPluginEnabled(org.id, 'invoice-automation'))) { orgsSkippedDisabled++; continue }
      const orgName = org.name || org.crmName || 'CRM'

      // Config del plugin (por organización, opt-in):
      //  - dueSameMonth: vence el día `diaVencimiento` de ESTE mes (default: mes siguiente)
      //  - autoSend: manda la factura al cliente sola (default: queda Pendiente para revisar)
      const cfg = (await getPluginConfig(org.id, 'invoice-automation')) as
        | { dueSameMonth?: unknown; autoSend?: unknown } | null
      const dueSameMonth = cfgTrue(cfg?.dueSameMonth)
      const autoSend = cfgTrue(cfg?.autoSend)
      const legacyDueDate = dueSameMonth ? dateOnlyArgentina(y, m, 5) : dueDate

      // 1) Abonos (ServicioRecurrente) por su ciclo — un anual factura una vez
      //    al año, un mensual todos los meses, etc. billAbonosForOrg es
      //    idempotente: no duplica si ya se facturó ese abono este mes.
      const abonoPreview = await billAbonosForOrg(org.id, { dryRun: true })

      // 2) Flujo viejo por Empresa.monthlyAmount — SÓLO para empresas que NO
      //    tienen ningún abono activo (si tienen abono, ese es la fuente de
      //    verdad y el monthlyAmount se ignora, para no facturar dos veces).
      const conAbono = await empresasConAbono(org.id)
      const billableEmpresas = (await prisma.empresa.findMany({
        where: { organizationId: org.id, isCliente: true, monthlyAmount: { gt: 0 } },
        select: { id: true, name: true, monthlyAmount: true, billingCurrency: true },
      })).filter((e) => !conAbono.has(e.id))

      const existingInvoices = billableEmpresas.length === 0 ? [] : await prisma.invoice.findMany({
        where: {
          empresaId: { in: billableEmpresas.map((e) => e.id) },
          createdAt: { gte: startOfMonth, lt: endOfMonth },
        },
        select: { empresaId: true },
      })
      const alreadyBilledIds = new Set(existingInvoices.map((i) => i.empresaId))
      const legacyPending = billableEmpresas.filter((e) => !alreadyBilledIds.has(e.id))

      if (abonoPreview.items.length === 0 && legacyPending.length === 0) {
        orgsWithNothingToBill++; continue
      }

      if (dryRun) {
        for (const it of abonoPreview.items) {
          wouldCreate.push({ org: orgName, empresa: it.empresa, concepto: it.concepto, amount: it.amount, currency: it.currency })
        }
        for (const e of legacyPending) {
          wouldCreate.push({ org: orgName, empresa: e.name, concepto: `Facturación recurrente — ${monthName}`, amount: e.monthlyAmount ?? 0, currency: e.billingCurrency || 'USD' })
        }
        continue
      }

      // Idempotencia: ya se generó la tanda de este mes para esta org
      // (reintento de Vercel, o disparo manual duplicado) — no se genera de
      // nuevo. Ver modelo CronRun.
      if (!(await claimCronRun(JOB_NAME, org.id, startOfMonth))) { orgsSkippedAlreadySent++; continue }

      const abonoRes = await billAbonosForOrg(org.id, { dueSameMonth })
      invoicesCreated += abonoRes.created
      const createdIds = [...abonoRes.createdInvoiceIds]

      let legacyCreated = 0
      if (legacyPending.length > 0) {
        for (const e of legacyPending) {
          const inv = await prisma.invoice.create({
            data: {
              empresaId: e.id,
              organizationId: org.id,
              amount: e.monthlyAmount ?? 0,
              currency: e.billingCurrency || 'USD',
              description: `Facturación recurrente — ${monthName}`,
              dueDate: legacyDueDate,
              status: 'PENDING' as const,
            },
            select: { id: true },
          })
          createdIds.push(inv.id)
          legacyCreated++
        }
        invoicesCreated += legacyCreated
      }

      // Auto-envío al cliente (opt-in). Sin PDF adjunto — el mail lleva el
      // detalle + el botón "Pagar ahora". Best-effort: si un envío falla, no
      // frena el resto ni la corrida.
      let autoSent = 0
      const autoSendFails: string[] = []
      if (autoSend) {
        for (const invId of createdIds) {
          try {
            const r = await sendInvoiceEmail({ invoiceId: invId, organizationId: org.id, req })
            if (r.ok) autoSent++
            else autoSendFails.push(r.error ?? 'error')
          } catch (err) {
            console.error('[CRON INVOICE-AUTOMATION] auto-envío falló:', invId, err)
            autoSendFails.push('excepción')
          }
        }
      }

      const totalCreated = abonoRes.created + legacyCreated
      if (totalCreated > 0 && isOrgEmailConfigured(org)) {
        try {
          const staff = await prisma.user.findMany({
            where: { organizationId: org.id, status: 'ACTIVE', role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
            select: { email: true },
          })
          const lines = [
            ...abonoRes.items.map((it) => `• ${it.empresa} — ${it.concepto} — ${it.currency} ${it.amount.toLocaleString('es-AR')}`),
            ...legacyPending.map((e) => `• ${e.name} — ${e.billingCurrency || 'USD'} ${(e.monthlyAmount ?? 0).toLocaleString('es-AR')}`),
          ].join('\n')
          const cierre = autoSend
            ? `${autoSent} de ${totalCreated} se enviaron solas al cliente por mail${autoSendFails.length ? ` (${autoSendFails.length} fallaron — revisalas en Facturación)` : ''}.`
            : 'Quedaron en estado "Pendiente" — entrá a Facturación para revisarlas antes de avisarle a cada cliente.'
          const html = buildEmailHtml(
            `${totalCreated} factura${totalCreated !== 1 ? 's' : ''} generada${totalCreated !== 1 ? 's' : ''} automáticamente`,
            `Facturación recurrente de ${monthName}:\n\n${lines}\n\n${cierre}`,
            orgName,
            org.primaryColor || '#6366f1',
            org.secondaryColor || '#8b5cf6',
          )
          for (const s of staff) {
            if (!s.email) continue
            await sendEmail({
              to: s.email,
              subject: `${totalCreated} factura${totalCreated !== 1 ? 's' : ''} generada${totalCreated !== 1 ? 's' : ''} — ${monthName} — ${orgName}`,
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
