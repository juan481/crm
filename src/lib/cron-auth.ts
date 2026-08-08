import { NextRequest } from 'next/server'

// Patrón estándar de Vercel Cron: cada invocación programada manda
// `Authorization: Bearer $CRON_SECRET`. Cualquier otro caller (sin ese
// header, o con un valor distinto) se rechaza — ver Fase 10 del plan.
// Requiere que la env var CRON_SECRET esté seteada en Vercel; si falta acá
// en el server, se rechaza todo por seguridad (fail-closed, no fail-open).
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}
