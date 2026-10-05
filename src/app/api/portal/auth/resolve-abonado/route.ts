import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/portal/auth/resolve-abonado — traduce un número de abonado al
// email SINTÉTICO interno con el que ese usuario está cargado en Supabase
// Auth (ver numeroAbonado en schema.prisma), para que el front pueda llamar
// a signInWithPassword con ese email + la contraseña que tipeó el cliente.
//
// Público (el cliente todavía no tiene sesión en este punto). Rate-limited
// por IP igual que /api/portal/auth/request-link — sin esto, alguien podría
// probar números de abonado en loop para ver cuáles existen.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { limited } = await checkRateLimit('portal_abonado', ip, { max: 10, windowMinutes: 15 })
  if (limited) return NextResponse.json({ error: 'Demasiados intentos — probá de nuevo en un rato.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const numeroAbonado = typeof body?.numeroAbonado === 'string' ? body.numeroAbonado.trim() : ''
  if (!numeroAbonado) return NextResponse.json({ error: 'Falta el número de abonado' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { numeroAbonado },
    select: { email: true, role: true, status: true, empresaId: true },
  })

  // Mismo criterio de privacidad que sendPortalMagicLink: no se filtra si el
  // número existe o no con un status/mensaje distinto.
  if (!user || user.role !== 'CLIENTE' || user.status !== 'ACTIVE' || !user.empresaId) {
    return NextResponse.json({ error: 'Número de abonado o contraseña incorrectos.' }, { status: 404 })
  }

  return NextResponse.json({ email: user.email })
}
