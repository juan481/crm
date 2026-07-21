import nodemailer from 'nodemailer'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
  // Amazon SES
  provider?: 'SMTP' | 'BREVO' | 'SES'
  sesRegion?: string
  sesAccessKeyId?: string
  sesSecretKey?: string
  sesConfigSet?: string
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

export interface OrgEmailFields {
  smtpProvider?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPass?: string | null
  smtpFrom?: string | null
  sesRegion?: string | null
  sesAccessKeyId?: string | null
  sesSecretKey?: string | null
  sesFrom?: string | null
  sesConfigSet?: string | null
}

/**
 * Turns an Organization row into the SmtpConfig sendEmail() expects, picking
 * SES or SMTP based on the org's chosen `smtpProvider`. Centralized here so
 * every send site (quotes, campaigns, empresa emails) honors the same
 * provider switch instead of each route re-deriving it (and risking one
 * still hardcoded to SMTP after the org migrates to SES).
 */
export function resolveOrgSmtpConfig(org: OrgEmailFields | null | undefined): SmtpConfig | undefined {
  if (!org) return undefined

  if (org.smtpProvider === 'SES') {
    if (!org.sesRegion || !org.sesAccessKeyId || !org.sesSecretKey) return undefined
    return {
      provider: 'SES', host: '', port: 587, user: '', pass: '',
      from: org.sesFrom ?? '',
      sesRegion: org.sesRegion, sesAccessKeyId: org.sesAccessKeyId, sesSecretKey: org.sesSecretKey,
      sesConfigSet: org.sesConfigSet ?? undefined,
    }
  }

  if (org.smtpHost && org.smtpUser && org.smtpPass) {
    return { host: org.smtpHost, port: org.smtpPort ?? 587, user: org.smtpUser, pass: org.smtpPass, from: org.smtpFrom ?? org.smtpUser }
  }

  return undefined
}

/** Whether the org has enough email config to actually send (SES or SMTP), without leaking secrets. */
export function isOrgEmailConfigured(org: OrgEmailFields | null | undefined): boolean {
  return !!resolveOrgSmtpConfig(org)
}

// Amazon SES via SDK v3. SES's simple SendEmail API has no attachment support,
// so when attachments are present we build a raw RFC822 MIME message instead
// (via nodemailer's MailComposer — used purely to compose bytes, never to
// connect anywhere) and submit it through SendRawEmail.
async function sendViaSES(
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  opts: { from: string; to: string | string[]; subject: string; html: string; attachments?: EmailAttachment[] },
  configSet?: string
): Promise<{ messageId: string }> {
  const toArr = Array.isArray(opts.to) ? opts.to : [opts.to]
  const client = new (await import('@aws-sdk/client-ses')).SESClient({ region, credentials: { accessKeyId, secretAccessKey } })

  if (opts.attachments?.length) {
    const { SendRawEmailCommand } = await import('@aws-sdk/client-ses')
    const { default: MailComposer } = await import('nodemailer/lib/mail-composer/index.js')
    const mail = new MailComposer({
      from: opts.from, to: toArr, subject: opts.subject, html: opts.html,
      attachments: opts.attachments,
    })
    const raw = await new Promise<Buffer>((resolve, reject) => {
      mail.compile().build((err: Error | null, message: Buffer) => err ? reject(err) : resolve(message))
    })

    const res = await client.send(new SendRawEmailCommand({
      Source: opts.from,
      Destinations: toArr,
      RawMessage: { Data: raw },
      ConfigurationSetName: configSet || undefined,
    }))
    return { messageId: res.MessageId ?? '' }
  }

  const { SendEmailCommand } = await import('@aws-sdk/client-ses')
  const res = await client.send(new SendEmailCommand({
    Source: opts.from,
    Destination: { ToAddresses: toArr },
    Message: {
      Subject: { Data: opts.subject, Charset: 'UTF-8' },
      Body:    { Html: { Data: opts.html, Charset: 'UTF-8' } },
    },
    ConfigurationSetName: configSet || undefined,
  }))
  return { messageId: res.MessageId ?? '' }
}

// Brevo HTTP API — no IP restrictions, works from any serverless environment
async function sendViaBrevoApi(apiKey: string, opts: {
  from: string; to: string | string[]; subject: string; html: string; attachments?: EmailAttachment[]
}): Promise<{ messageId?: string }> {
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

  const data = await res.json().catch(() => ({})) as { messageId?: string }
  return { messageId: data.messageId }
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

export async function sendEmail({
  to, subject, html, from, smtpConfig, attachments,
}: SendEmailOptions): Promise<{ messageId?: string }> {
  const fromAddress = from
    ?? resolveFrom(smtpConfig?.from, smtpConfig?.user)
    ?? process.env.SMTP_FROM
    ?? 'CRM Pro <noreply@crmpro.com>'

  // Amazon SES — triggered when provider is explicitly 'SES' or env vars are set
  if (
    smtpConfig?.provider === 'SES' ||
    (process.env.AWS_SES_REGION && !smtpConfig?.host)
  ) {
    const region  = smtpConfig?.sesRegion       ?? process.env.AWS_SES_REGION       ?? ''
    const akid    = smtpConfig?.sesAccessKeyId  ?? process.env.AWS_SES_ACCESS_KEY_ID ?? ''
    const secret  = smtpConfig?.sesSecretKey    ?? process.env.AWS_SES_SECRET_ACCESS_KEY ?? ''
    const cs      = smtpConfig?.sesConfigSet    ?? process.env.AWS_SES_CONFIG_SET
    if (!region || !akid || !secret) {
      throw new Error('Amazon SES: faltan credenciales (región, Access Key ID o Secret)')
    }
    return sendViaSES(region, akid, secret, { from: fromAddress, to, subject, html, attachments }, cs)
  }

  // Use Brevo HTTP API (no IP restrictions) when key starts with xkeysib-
  if (smtpConfig?.pass?.startsWith('xkeysib-') || process.env.BREVO_API_KEY) {
    const apiKey = (smtpConfig?.pass?.startsWith('xkeysib-') ? smtpConfig.pass : null) ?? process.env.BREVO_API_KEY!
    return sendViaBrevoApi(apiKey, { from: fromAddress, to, subject, html, attachments })
  }

  const transporter = createTransporter(smtpConfig)
  const info = await transporter.sendMail({ from: fromAddress, to, subject, html, attachments })
  return { messageId: info.messageId }
}

export async function testSmtp(cfg: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    // Amazon SES — verify credentials
    if (cfg.provider === 'SES') {
      const { SESClient, GetSendQuotaCommand } = await import('@aws-sdk/client-ses')
      const region = cfg.sesRegion ?? ''
      const akid   = cfg.sesAccessKeyId ?? cfg.user ?? ''
      const secret = cfg.sesSecretKey ?? cfg.pass ?? ''
      if (!region || !akid || !secret) return { ok: false, error: 'Completá región, Access Key ID y Secret' }
      const client = new SESClient({ region, credentials: { accessKeyId: akid, secretAccessKey: secret } })
      await client.send(new GetSendQuotaCommand({}))
      return { ok: true }
    }

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
  orgName        = 'CRM Pro',
  primaryColor   = '#6366f1',
  secondaryColor = '#8b5cf6',
  trackingPixelUrl?: string,
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
  </div>${trackingPixelUrl ? `\n  <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;border:0" alt="" />` : ''}
</body>
</html>`
}
