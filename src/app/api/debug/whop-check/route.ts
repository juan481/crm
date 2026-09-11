import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DEBUG TEMPORAL — 2026-09-11. Diagnóstico de por qué Whop devuelve
// "Account not found" en producción. Muestra (enmascarado, sólo prefijo +
// largo, nunca el secreto completo) qué ve el server de las env vars de
// Whop. Sólo ADMIN+. BORRAR este archivo una vez resuelto.
export async function GET() {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const key = process.env.WHOP_API_KEY ?? null
  const companyId = process.env.WHOP_COMPANY_ID ?? null
  const productId = process.env.WHOP_PRODUCT_ID ?? null
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET ?? null
  const sandbox = process.env.WHOP_SANDBOX ?? null

  return NextResponse.json({
    WHOP_API_KEY: key ? { prefix: key.slice(0, 14), largo: key.length } : null,
    WHOP_COMPANY_ID: companyId, // no es secreto, es el id público biz_...
    WHOP_PRODUCT_ID: productId, // tampoco es secreto
    WHOP_WEBHOOK_SECRET: webhookSecret ? { largo: webhookSecret.length } : null,
    WHOP_SANDBOX: sandbox,
    deployedAt: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  })
}
