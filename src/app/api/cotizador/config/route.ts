import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Lightweight, role-agnostic endpoint so any org member building a quote (including SELLER,
// who can't hit /api/settings/branding) can read the org's default quote validity.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const org = await prisma.organization.findUnique({
      where:  { id: payload.orgId },
      select: { quoteValidityDays: true, recargoTarjetaPct: true, descuentoEfectivoPct: true },
    })

    return NextResponse.json({
      data: {
        quoteValidityDays: org?.quoteValidityDays ?? 30,
        recargoTarjetaPct: org?.recargoTarjetaPct ?? 0,
        descuentoEfectivoPct: org?.descuentoEfectivoPct ?? 0,
      },
    })
  } catch (error) {
    console.error('[COTIZADOR CONFIG]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Carga el % de recargo tarjeta / descuento efectivo (reestructuración Abba
// 2026-10) — faltaba esta mitad: el motor ya los usa (ver quote-totals.ts/
// cotizador/send) pero nunca se construyó cómo CARGARLOS, sólo cómo leerlos.
// Sólo ADMIN+ — misma sensibilidad que cualquier otro número de pricing.
export async function PATCH(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { recargoTarjetaPct, descuentoEfectivoPct } = await req.json()
    const valid = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100
    if (recargoTarjetaPct !== undefined && !valid(recargoTarjetaPct))
      return NextResponse.json({ error: 'El recargo de tarjeta tiene que ser un número entre 0 y 100' }, { status: 400 })
    if (descuentoEfectivoPct !== undefined && !valid(descuentoEfectivoPct))
      return NextResponse.json({ error: 'El descuento de efectivo tiene que ser un número entre 0 y 100' }, { status: 400 })

    const org = await prisma.organization.update({
      where: { id: payload.orgId },
      data: {
        ...(recargoTarjetaPct !== undefined && { recargoTarjetaPct }),
        ...(descuentoEfectivoPct !== undefined && { descuentoEfectivoPct }),
      },
      select: { recargoTarjetaPct: true, descuentoEfectivoPct: true },
    })

    return NextResponse.json({ data: org })
  } catch (error) {
    console.error('[COTIZADOR CONFIG PATCH]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
