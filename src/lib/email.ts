import nodemailer from 'nodemailer'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
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
  if (smtpFrom.includes('@')) return smtpFrom          // already a valid address or "Name <email>"
  return `${smtpFrom} <${fallback}>`                   // "Abba Seguridad" → "Abba Seguridad <user@smtp-brevo.com>"
}

export async function sendEmail({ to, subject, html, from, smtpConfig, attachments }: SendEmailOptions) {
  const transporter = createTransporter(smtpConfig)
  const fromAddress = from ?? resolveFrom(smtpConfig?.from, smtpConfig?.user) ?? process.env.SMTP_FROM ?? 'CRM Pro <noreply@crmpro.com>'
  await transporter.sendMail({ from: fromAddress, to, subject, html, attachments })
}

export async function testSmtp(cfg: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = createTransporter(cfg)
    await transporter.verify()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function buildEmailHtml(subject: string, body: string, orgName = 'CRM Pro'): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <style>
    body{font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:0}
    .container{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px}
    .header h1{color:#fff;margin:0;font-size:22px;font-weight:600}
    .body{padding:40px;color:#1e293b;line-height:1.7;font-size:15px}
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
