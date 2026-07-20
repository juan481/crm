import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Lightweight, role-agnostic endpoint so any org member building a quote (including SELLER,
// who can't hit /api/settings/branding) can read the org's default quote validity.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const org = await prisma.organization.findUnique({
      where:  { id: payload.orgId },
      select: { quoteValidityDays: true },
    })

    return NextResponse.json({ data: { quoteValidityDays: org?.quoteValidityDays ?? 30 } })
  } catch (error) {
    console.error('[COTIZADOR CONFIG]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
