import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Se llama una sola vez, desde el login (ver (auth)/login/page.tsx) justo
// después de que Supabase confirma la contraseña — server-side, así que no
// se puede falsear desde el cliente (a diferencia del fichaje, que es un
// botón que el empleado elige tocar o no). Best-effort: si esto falla, el
// login en sí ya se completó igual, no bloquea nada.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const userAgent = req.headers.get('user-agent') || null

    await (prisma as any).loginEvent.create({
      data: { userId: payload.userId, organizationId: payload.orgId, type: 'LOGIN', ipAddress, userAgent },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[LOG LOGIN]', error)
    // 200 igual — no queremos que un fallo acá se vea como un error de login
    // real en la pantalla del usuario.
    return NextResponse.json({ ok: false })
  }
}
