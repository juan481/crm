// Pagos & Portal — candado multi-tenant (Nivel 1).
//
// Las credenciales de pago (Whop / Mercado Pago) son UNA sola por deploy
// (env vars de Vercel), y ese deploy sirve a TODOS los tenants del CRM. Sin
// este candado, cualquier organización que active `invoice-automation` (ej.
// Abba) tendría botón "Pagar" en sus facturas → la plata de SUS clientes
// caería en la cuenta de Just Create.
//
// `PAYMENTS_ORG_IDS` = lista separada por comas de los organizationId
// habilitados para cobrar online. Sólo se setea en Vercel (Abba no tiene
// acceso). FAIL-SAFE: si está vacío/ausente, NADIE cobra.
//
// Nivel 2 (cuando un 2º cliente pida cobrar): mover a un plugin `payments`
// con credenciales por organización + webhook ruteado por token de org.

export function paymentsEnabledForOrg(orgId: string): boolean {
  const raw = process.env.PAYMENTS_ORG_IDS ?? ''
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return ids.includes(orgId)
}
