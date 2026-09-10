import { prisma } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { appBaseUrl } from '@/lib/app-url'

// Genera y manda el enlace de acceso al Portal de Clientes con NUESTRO diseño
// y desde el correo de la organización — NO el mail genérico de Supabase
// ("Your Magic Link", noreply@mail.app.supabase.io).
//
// Usa `admin.generateLink` (genera el token, NO manda mail) + verifyOtp con
// token_hash en el callback.

export interface PortalMagicResult { ok: boolean; error?: string }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function darken(hex: string, f = 0.68): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#4338ca'
  const n = parseInt(m[1], 16)
  return `#${((1 << 24) | (Math.round(((n >> 16) & 255) * f) << 16) | (Math.round(((n >> 8) & 255) * f) << 8) | Math.round((n & 255) * f)).toString(16).slice(1)}`
}

export async function sendPortalMagicLink(
  emailRaw: string,
  req?: { headers: Headers },
): Promise<PortalMagicResult> {
  const email = emailRaw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Email inválido' }

  // El usuario de portal tiene que existir (lo crea el admin desde la ficha).
  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true, status: true, empresaId: true, organizationId: true, name: true },
  })
  // No se filtra si el email existe o no — se responde ok igual (privacidad).
  if (!user || user.role !== 'CLIENTE' || user.status !== 'ACTIVE' || !user.empresaId) {
    return { ok: true }
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      name: true, crmName: true, logoUrl: true, primaryColor: true,
      smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
      smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
    },
  })
  if (!org || !isOrgEmailConfigured(org)) return { ok: false, error: 'La organización no tiene correo configurado' }

  const appUrl = appBaseUrl(req)

  let hashedToken: string
  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${appUrl}/portal/auth/callback` },
    })
    if (error || !data?.properties?.hashed_token) {
      console.error('[PORTAL MAGIC] generateLink falló:', error?.message)
      return { ok: false, error: 'No se pudo generar el enlace' }
    }
    hashedToken = data.properties.hashed_token
  } catch (err) {
    console.error('[PORTAL MAGIC]', err)
    return { ok: false, error: 'No se pudo generar el enlace' }
  }

  const link = `${appUrl}/portal/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink`
  const orgName = org.name || org.crmName || 'Portal'
  const accent = /^#[0-9a-f]{6}$/i.test(org.primaryColor || '') ? org.primaryColor! : '#6366f1'
  const FONT = "'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

  const logoChip = org.logoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#fff;border-radius:12px;padding:8px 10px;line-height:0"><img src="${org.logoUrl}" alt="${esc(orgName)}" width="30" height="30" style="display:block;width:30px;height:30px;object-fit:contain;border-radius:6px"/></td></tr></table>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet"/></head>
<body style="margin:0;padding:0;background:#eef3f0;font-family:${FONT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f0;padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,.10)">
      <tr><td style="background:linear-gradient(135deg,${accent},${darken(accent)});padding:24px 28px">
        <table role="presentation" width="100%"><tr>
          <td style="vertical-align:middle">${logoChip}</td>
          <td style="vertical-align:middle;text-align:right;color:#fff;font-weight:700;font-size:16px">${esc(orgName)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px 28px 8px;text-align:center">
        <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a">Ingresá a tu portal</p>
        <p style="margin:10px 0 0;font-size:14px;color:#64748b;line-height:1.6">Tocá el botón para entrar. El enlace es de un solo uso y vence en 1 hora.</p>
      </td></tr>
      <tr><td style="padding:22px 28px 8px">
        <a href="${link}" style="display:block;background:${accent};color:#fff;text-decoration:none;font-weight:700;font-size:16px;text-align:center;padding:15px 0;border-radius:14px">Entrar al portal</a>
      </td></tr>
      <tr><td style="padding:6px 28px 0;text-align:center;font-size:11px;color:#94a3b8">Si no funciona el botón, copiá este enlace:<br/><a href="${link}" style="color:#94a3b8;word-break:break-all">${link}</a></td></tr>
      <tr><td style="padding:26px 28px 22px;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center">Si no pediste este acceso, ignorá este correo.</td></tr>
      <tr><td style="padding:14px 28px;background:#f7f9fb;border-top:1px solid #eef2f6;text-align:center;font-size:11px;color:#b6c1cc">${esc(orgName)}</td></tr>
    </table>
  </td></tr></table>
</body></html>`

  try {
    await sendEmail({
      to: email,
      subject: `Tu acceso al portal — ${orgName}`,
      html,
      smtpConfig: resolveOrgSmtpConfig(org),
    })
  } catch (err) {
    console.error('[PORTAL MAGIC] envío falló:', err)
    return { ok: false, error: 'No se pudo enviar el enlace' }
  }

  return { ok: true }
}
