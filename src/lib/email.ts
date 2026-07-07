import nodemailer from 'nodemailer'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
  encoding?: string
}

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  smtpConfig?: SmtpConfig
  attachments?: EmailAttachment[]
}

// If smtpFrom is only a display name (no @), combine it with smtpUser as the actual address
function resolveFrom(smtpFrom: string | undefined, smtpUser: string | undefined): string {
  const fallback = smtpUser || 'noreply@crmpro.com'
  if (!smtpFrom) return fallback
  if (smtpFrom.includes('@')) return smtpFrom
  return `${smtpFrom} <${fallback}>`
}

// Brevo HTTP API — no IP restrictions, works from any serverless environment
async function sendViaBrevoApi(apiKey: string, opts: {
  from: string; to: string | string[]; subject: string; html: string; attachments?: EmailAttachment[]
}) {
  const fromMatch = opts.from.match(/^(.+?)\s*<(.+?)>$/)
  const sender    = fromMatch
    ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
    : { email: opts.from.trim() }

  const toArr = (Array.isArray(opts.to) ? opts.to : [opts.to]).map(e => ({ email: e.trim() }))

  const body: Record<string, unknown> = {
    sender, to: toArr, subject: opts.subject, htmlContent: opts.html,
  }

  if (opts.attachments?.length) {
    body.attachment = opts.attachments.map(a => ({
      name:    a.filename,
      content: Buffer.isBuffer(a.content)
        ? a.content.toString('base64')
        : Buffer.from(a.content as string).toString('base64'),
    }))
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `Brevo API error ${res.status}`)
  }
}

function createTransporter(cfg?: SmtpConfig) {
  const port = cfg?.port ?? (Number(process.env.SMTP_PORT) || 587)
  return nodemailer.createTransport({
    host:       cfg?.host || process.env.SMTP_HOST,
    port,
    secure:     port === 465,
    requireTLS: port !== 465,
    auth: {
      user: cfg?.user || process.env.SMTP_USER,
      pass: cfg?.pass || process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  })
}

export async function sendEmail({ to, subject, html, from, smtpConfig, attachments }: SendEmailOptions) {
  const fromAddress = from ?? resolveFrom(smtpConfig?.from, smtpConfig?.user) ?? process.env.SMTP_FROM ?? 'CRM Pro <noreply@crmpro.com>'

  // Use Brevo HTTP API (no IP restrictions) when key starts with xkeysib-
  if (smtpConfig?.pass?.startsWith('xkeysib-') || process.env.BREVO_API_KEY) {
    const apiKey = (smtpConfig?.pass?.startsWith('xkeysib-') ? smtpConfig.pass : null) ?? process.env.BREVO_API_KEY!
    await sendViaBrevoApi(apiKey, { from: fromAddress, to, subject, html, attachments })
    return
  }

  const transporter = createTransporter(smtpConfig)
  await transporter.sendMail({ from: fromAddress, to, subject, html, attachments })
}

export async function testSmtp(cfg: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    // If it's a Brevo API key, verify via HTTP instead of SMTP connection
    if (cfg.pass?.startsWith('xkeysib-')) {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': cfg.pass },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string }
        return { ok: false, error: err.message ?? `Brevo API error ${res.status}` }
      }
      return { ok: true }
    }

    const transporter = createTransporter(cfg)
    await transporter.verify()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function buildEmailHtml(
  subject: string,
  body: string,
  orgName      = 'CRM Pro',
  primaryColor = '#6366f1',
  secondaryColor = '#8b5cf6',
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <style>
    body{font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:0}
    .container{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,${primaryColor} 0%,${secondaryColor} 100%);padding:32px 40px}
    .header h1{color:#fff;margin:0;font-size:22px;font-weight:600}
    .body{padding:40px;color:#1e293b;line-height:1.7;font-size:15px}
    .body img{max-width:100%;height:auto;display:block}
    .footer{background:#f1f5f9;padding:20px 40px;text-align:center;color:#94a3b8;font-size:13px}
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${subject}</h1></div>
    <div class="body">${body.replace(/\n/g, '<br/>')}</div>
    <div class="footer">Enviado por ${orgName} &mdash; No responder a este correo.</div>
  </div>
</body>
</html>`
}
