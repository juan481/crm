import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserAny } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Se llama desde dos lugares:
// 1. El login (ver (auth)/login/page.tsx) justo después de que Supabase
//    confirma la contraseña → type: 'LOGIN' explícito.
// 2. AppShell (ver components/layout/app-shell.tsx), una vez por sesión de
//    navegador (sessionStorage), para capturar gente que YA estaba logueada
//    de antes de que existiera este feature — de otra forma esas cuentas
//    nunca iban a mostrar "última vez" hasta que alguien hiciera logout/
//    login manual, algo que no tiene sentido pedirle a todo un equipo.
//    → type: 'SEEN' (no es un login real, sólo evidencia de presencia; se
//    muestra distinto en el historial completo para no confundirlo con un
//    ingreso/salida real).
// Server-side siempre — así no se puede falsear desde el cliente (a
// diferencia del fichaje, que es un botón que el empleado elige tocar o
// no). Best-effort: si esto falla, no bloquea nada del lado del usuario.
//
// getCurrentUserAny() (no getCurrentUser()) a propósito — encontrado en
// auditoría: sólo escribe el propio login del usuario que llama
// (`userId: payload.userId`), nunca datos de otra cuenta, así que GREMIO
// debe poder loguear el suyo igual que cualquier rol. Con getCurrentUser()
// (que excluye GREMIO desde el fix de seguridad del Módulo 3) esto
// devolvía 401 en silencio para el portal — el login en sí funcionaba
// igual, pero esa cuenta nunca quedaba en el historial de accesos.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const type = body?.type === 'SEEN' ? 'SEEN' : 'LOGIN'

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const userAgent = req.headers.get('user-agent') || null

    await (prisma as any).loginEvent.create({
      data: { userId: payload.userId, organizationId: payload.orgId, type, ipAddress, userAgent },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[LOG LOGIN]', error)
    // 200 igual — no queremos que un fallo acá se vea como un error de login
    // real en la pantalla del usuario.
    return NextResponse.json({ ok: false })
  }
}
