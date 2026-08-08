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
// incluso si termina rechazado más adelante por otra validación (email
// inválido, honeypot, etc.) — si no, alguien podría "resetear" el contador
// mandando intentos inválidos a propósito.
export async function checkRateLimit(
  kind: string,
  identifier: string,
  opts: { max: number; windowMinutes: number }
): Promise<{ limited: boolean }> {
  const db = prisma as any
  const since = new Date(Date.now() - opts.windowMinutes * 60 * 1000)
  const count = await db.publicFormAttempt.count({ where: { kind, identifier, createdAt: { gte: since } } })
  const limited = count >= opts.max
  // Sólo se registra si todavía no estaba bloqueado. Una vez alcanzado el
  // límite, cada intento adicional de un bot insistiendo ya devuelve 429 sin
  // necesidad de otra fila — seguir insertando dejaría crecer la tabla sin
  // límite mientras dure el ataque, sin ganar nada a cambio. Las filas ya
  // guardadas igual "vencen" solas al salir de la ventana de `since`, así
  // que pasado windowMinutes se vuelve a permitir con normalidad.
  if (!limited) {
    await db.publicFormAttempt.create({ data: { kind, identifier } })
  }
  return { limited }
}
