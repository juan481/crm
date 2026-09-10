/**
 * Base URL de la app para armar links absolutos (mails, redirects, webhooks).
 *
 * Prioriza `NEXT_PUBLIC_APP_URL`, pero si esa env var falta o quedó con un
 * placeholder (pasa: `NEXT_PUBLIC_*` se hornea en build, si el deploy se hizo
 * antes de setearla bien queda "placeholder.vercel.app"), cae al host real del
 * request. Así un deploy mal configurado no rompe en silencio los links de
 * pago ni los `notification_url` de los webhooks.
 *
 * En contextos sin request (crons) sólo queda la env var — ahí sí tiene que
 * estar bien seteada.
 */
export function appBaseUrl(req?: { headers: Headers }): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const envUsable = env && !/placeholder|localhost|example\.com|127\.0\.0\.1/i.test(env)
  if (envUsable) return env

  if (req) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    if (host) return `${proto}://${host}`
  }
  return env
}
