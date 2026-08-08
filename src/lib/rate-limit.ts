import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// Vercel/la mayoría de los proxies mandan la IP real acá — no hay sesión ni
// otro identificador posible en un formulario público sin login.
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

// Rate limiting simple respaldado en DB (no hay Redis/Upstash en este
// proyecto, y un contador en memoria no sirve entre invocaciones serverless
// — cada una puede caer en una instancia distinta). Registra el intento
// SIEMPRE, incluso si termina rechazado más adelante por otra validación —
// si no, alguien podría "resetear" el contador mandando intentos inválidos.
export async function checkRateLimit(
  kind: string,
  identifier: string,
  opts: { max: number; windowMinutes: number }
): Promise<{ limited: boolean }> {
  const db = prisma as any
  const since = new Date(Date.now() - opts.windowMinutes * 60 * 1000)
  const count = await db.publicFormAttempt.count({ where: { kind, identifier, createdAt: { gte: since } } })
  await db.publicFormAttempt.create({ data: { kind, identifier } })
  return { limited: count >= opts.max }
}
