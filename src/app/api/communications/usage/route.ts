import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { getEmailUsage } from '@/lib/email-usage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const usage = await getEmailUsage(payload.orgId)
    return NextResponse.json({ data: usage })
  } catch (error) {
    console.error('[EMAIL USAGE GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
