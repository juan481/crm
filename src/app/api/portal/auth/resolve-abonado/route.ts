import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'
import { normalizarAbonado } from '@/lib/servicios-recurrentes'

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
  // Mismo normalizado que al crear el acceso (mayúsculas, sin espacios) —
  // así "1a2f" y "1A2F " entran igual.
  const numeroAbonado = normalizarAbonado(body?.numeroAbonado)
  if (!numeroAbonado) return NextResponse.json({ error: 'Número de abonado o contraseña incorrectos.' }, { status: 404 })

  let user = await prisma.user.findUnique({
    where: { numeroAbonado },
    select: { email: true, role: true, status: true, empresaId: true },
  })

  // "Con el dealer-abonado o con el abonado solo" (Seba, 25/10): si tipeó
  // sólo el número ("3434"), se busca el código completo que termina en ese
  // número detrás de las letras del dealer ("ABB3434"). Sólo si hay UNO
  // activo — si dos dealers comparten número, tiene que poner las letras.
  if (!user && /^\d+$/.test(numeroAbonado)) {
    const candidatos = await prisma.user.findMany({
      where: { numeroAbonado: { endsWith: numeroAbonado }, role: 'CLIENTE', status: 'ACTIVE' },
      select: { email: true, role: true, status: true, empresaId: true, numeroAbonado: true },
      take: 5,
    })
    const exactos = candidatos.filter((c) => new RegExp(`^[A-Z]+${numeroAbonado}$`).test(c.numeroAbonado ?? ''))
    if (exactos.length > 1) {
      return NextResponse.json({ error: 'Ese número existe en más de un dealer — ingresalo con las letras adelante (ej. ABB3434).' }, { status: 409 })
    }
    if (exactos.length === 1) user = exactos[0]
  }

  // Mismo criterio de privacidad que sendPortalMagicLink: no se filtra si el
  // número existe o no con un status/mensaje distinto.
  if (!user || user.role !== 'CLIENTE' || user.status !== 'ACTIVE' || !user.empresaId) {
    return NextResponse.json({ error: 'Número de abonado o contraseña incorrectos.' }, { status: 404 })
  }

  return NextResponse.json({ email: user.email })
}
