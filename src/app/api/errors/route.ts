import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserAny, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// getCurrentUserAny() a propósito: un error real puede pasar con la sesión
// en un estado raro (justo lo que se está intentando diagnosticar), así
// que esto no debe fallar por no poder resolver el rol — si ni siquiera
// hay payload, igual se guarda el error con organizationId/userEmail null,
// mejor eso que perder el reporte.
//
// POST: lo llama el ErrorBoundary del lado del cliente cuando atrapa un
// error real (no el ChunkLoadError, que se auto-recupera solo). Devuelve
// el mismo `code` que ya se le mostró al usuario en pantalla, para que
// después se pueda buscar acá.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUserAny().catch(() => null)
    const { code, message, stack, componentStack, url } = await req.json()
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Falta el código' }, { status: 400 })
    }

    await prisma.errorLog.create({
      data: {
        code,
        organizationId: payload?.orgId ?? null,
        userEmail: payload?.email ?? null,
        message: typeof message === 'string' ? message.slice(0, 2000) : 'Sin mensaje',
        stack: typeof stack === 'string' ? stack.slice(0, 10_000) : null,
        componentStack: typeof componentStack === 'string' ? componentStack.slice(0, 10_000) : null,
        url: typeof url === 'string' ? url.slice(0, 500) : null,
        userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      },
    })

    return NextResponse.json({ data: { code } })
  } catch (error) {
    // Nunca debe tirar un error EL ENDPOINT que registra errores —
    // fallaría silenciosamente del lado del cliente (fire-and-forget) y
    // listo, no hay vuelta atrás posible acá.
    console.error('[ERRORS POST]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// GET ?code=XXXX — para buscar un error puntual que alguien reportó por
// código. GET sin ?code lista los últimos, para tener un pulso general.
// ADMIN+ únicamente — a diferencia de los endpoints de catálogo, acá NO
// corresponde el patrón "SELLER+ o GREMIO explícito": un stack trace puede
// traer rutas internas, el email de otro miembro del equipo, etc. Copiar
// ese patrón sin pensarlo (como se hizo al escribir esto la primera vez)
// dejaba a cualquier vendedor, e incluso una cuenta Gremio (un revendedor
// externo, ver auth.ts), leer los errores de TODA la organización con sólo
// llamar a la API directo — el link del menú es sólo para ADMIN/SUPER_ADMIN,
// pero el endpoint no lo exigía.
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const code = req.nextUrl.searchParams.get('code')?.trim()
    const db = prisma as any
    if (code) {
      const row = await db.errorLog.findFirst({ where: { code, organizationId: payload.orgId } })
      if (!row) return NextResponse.json({ error: `No se encontró ningún error con el código "${code}"` }, { status: 404 })
      return NextResponse.json({ data: row })
    }

    const rows = await db.errorLog.findMany({
      where: { organizationId: payload.orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ data: rows })
  } catch (error) {
    console.error('[ERRORS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
