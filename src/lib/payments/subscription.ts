import { prisma } from '@/lib/db'
import { providerForCurrency, type PayProvider } from './types'
import { paymentsEnabledForOrg } from './config'
import { createWhopAbonoSubscription, whopConfigured } from './whop'
import { createMpAbonoPreapproval, mercadoPagoConfigured } from './mercadopago'

// Débito automático de un abono (ServicioRecurrente) — crea el plan
// recurrente (Whop) o el preapproval (Mercado Pago) y guarda el link de
// autorización que se le manda al cliente 1 sola vez.

const CICLO_MESES: Record<string, number> = {
  MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12,
}

export interface AbonoForSub {
  id: string
  nombre: string
  monto: number
  moneda: string
  ciclo: string
  empresaId: string | null
}

export function subscriptionProviderConfigured(provider: PayProvider): boolean {
  return provider === 'WHOP' ? whopConfigured() : mercadoPagoConfigured()
}

/**
 * Crea (o recrea) la suscripción externa para un abono. Devuelve el link de
 * autorización y persiste subProvider/subExternalId/subAuthUrl/subStatus.
 */
export async function createAbonoSubscription(
  abono: AbonoForSub,
  organizationId: string,
  forcedProvider?: PayProvider,
): Promise<{ authUrl: string; provider: PayProvider }> {
  if (!paymentsEnabledForOrg(organizationId)) {
    throw new Error('El cobro online no está habilitado para esta organización')
  }
  const meses = CICLO_MESES[abono.ciclo]
  if (!meses) throw new Error(`El ciclo "${abono.ciclo}" no admite débito automático (sólo mensual/trimestral/semestral/anual)`)
  if (!(abono.monto > 0)) throw new Error('El abono no tiene monto')

  const provider = forcedProvider ?? providerForCurrency(abono.moneda)
  if (!subscriptionProviderConfigured(provider)) {
    throw new Error(`El proveedor (${provider}) no está configurado`)
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const concepto = `${abono.nombre}`
  const backUrl = `${appUrl}/portal`

  let authUrl: string
  let externalId: string

  if (provider === 'WHOP') {
    const res = await createWhopAbonoSubscription({
      amount: abono.monto,
      currency: abono.moneda,
      concepto,
      abonoId: abono.id,
      billingPeriodDays: meses * 30,
      redirectUrl: backUrl,
    })
    authUrl = res.authUrl
    externalId = res.externalId
  } else {
    let payerEmail: string | null = null
    if (abono.empresaId) {
      const c = await prisma.directorioContacto.findFirst({
        where: { organizationId, empresaId: abono.empresaId, email: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { email: true },
      })
      payerEmail = c?.email ?? null
    }
    const res = await createMpAbonoPreapproval({
      amount: abono.monto,
      currency: abono.moneda,
      concepto,
      abonoId: abono.id,
      frequencyMonths: meses,
      payerEmail,
      backUrl,
      notificationUrl: `${appUrl}/api/webhooks/mercadopago`,
    })
    authUrl = res.authUrl
    externalId = res.externalId
  }

  await prisma.servicioRecurrente.update({
    where: { id: abono.id },
    data: {
      subProvider: provider,
      subExternalId: externalId,
      subAuthUrl: authUrl,
      subStatus: 'PENDIENTE_AUTORIZACION',
    },
  })

  return { authUrl, provider }
}

/** Marca la suscripción como cancelada del lado del CRM (no llama al proveedor). */
export async function markAbonoSubscriptionCancelled(abonoId: string): Promise<void> {
  await prisma.servicioRecurrente.updateMany({
    where: { id: abonoId },
    data: { subStatus: 'CANCELADO' },
  })
}
