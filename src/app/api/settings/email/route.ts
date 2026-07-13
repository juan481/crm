import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { testSmtp, type SmtpConfig } from '@/lib/email'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    // Original SMTP fields — always in schema, never fails
    const smtpOrg = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true },
    })

    // SES + provider fields — added in ses-tracking migration, may not exist yet
    let sesData: {
      smtpProvider: string
      sesRegion: string
      sesAccessKeyId: string
      sesFrom: string
      sesConfigSet: string
      hasSecretKey: boolean
    } = { smtpProvider: 'SMTP', sesRegion: '', sesAccessKeyId: '', sesFrom: '', sesConfigSet: '', hasSecretKey: false }

    try {
      const sesOrg = await (prisma as any).organization.findUnique({
        where: { id: payload.orgId },
        select: {
          smtpProvider: true,
          sesRegion: true, sesAccessKeyId: true, sesSecretKey: true,
          sesFrom: true, sesConfigSet: true,
        },
      })
      if (sesOrg) {
        sesData = {
          smtpProvider:   sesOrg.smtpProvider   ?? 'SMTP',
          sesRegion:      sesOrg.sesRegion       ?? '',
          sesAccessKeyId: sesOrg.sesAccessKeyId  ?? '',
          sesFrom:        sesOrg.sesFrom         ?? '',
          sesConfigSet:   sesOrg.sesConfigSet    ?? '',
          hasSecretKey:   !!(sesOrg.sesSecretKey),
        }
      }
    } catch { /* SES migration not yet applied — serve SMTP-only data */ }

    return NextResponse.json({
      data: {
        smtpHost:    smtpOrg?.smtpHost ?? '',
        smtpPort:    smtpOrg?.smtpPort ?? 587,
        smtpUser:    smtpOrg?.smtpUser ?? '',
        smtpFrom:    smtpOrg?.smtpFrom ?? '',
        hasPassword: !!(smtpOrg?.smtpPass),
        ...sesData,
      },
    })
  } catch (error) {
    console.error('[EMAIL SETTINGS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const {
      smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom,
      smtpProvider,
      sesRegion, sesAccessKeyId, sesSecretKey, sesFrom, sesConfigSet,
      test,
    } = body

    const db = prisma as any

    if (test) {
      if (smtpProvider === 'SES' || body.provider === 'SES') {
        if (!sesRegion || !sesAccessKeyId) {
          return NextResponse.json({ error: 'Completá región y Access Key ID' }, { status: 400 })
        }
        // Use stored secret key if not re-entered
        let resolvedSecret = sesSecretKey
        if (!resolvedSecret) {
          const stored = await (prisma as any).organization.findUnique({
            where: { id: payload.orgId },
            select: { sesSecretKey: true },
          })
          resolvedSecret = stored?.sesSecretKey
        }
        if (!resolvedSecret) {
          return NextResponse.json({ error: 'Ingresá el Secret Access Key para probar' }, { status: 400 })
        }
        const cfg: SmtpConfig = {
          provider: 'SES', host: '', port: 587, user: sesAccessKeyId, pass: resolvedSecret,
          from: sesFrom ?? '',
          sesRegion, sesAccessKeyId, sesSecretKey: resolvedSecret, sesConfigSet: sesConfigSet || undefined,
        }
        const result = await testSmtp(cfg)
        return NextResponse.json({ ok: result.ok, error: result.error })
      }

      if (!smtpHost || !smtpUser) {
        return NextResponse.json({ error: 'Completá host y usuario para probar' }, { status: 400 })
      }
      // Use stored password if not re-entered
      let resolvedPass = smtpPass
      if (!resolvedPass) {
        const stored = await prisma.organization.findUnique({
          where: { id: payload.orgId },
          select: { smtpPass: true },
        })
        resolvedPass = stored?.smtpPass ?? undefined
      }
      if (!resolvedPass) {
        return NextResponse.json({ error: 'Ingresá la contraseña para probar' }, { status: 400 })
      }
      const result = await testSmtp({
        host: smtpHost,
        port: Number(smtpPort) || 587,
        user: smtpUser,
        pass: resolvedPass,
        from: smtpFrom || smtpUser,
      })
      return NextResponse.json({ ok: result.ok, error: result.error })
    }

    // Save config
    const data: Record<string, unknown> = {}

    if (smtpProvider !== undefined) {
      try { data.smtpProvider = smtpProvider } catch { /* migration pending */ }
    }

    if (smtpProvider === 'SES') {
      if (sesRegion      !== undefined) data.sesRegion      = sesRegion
      if (sesAccessKeyId !== undefined) data.sesAccessKeyId = sesAccessKeyId
      if (sesSecretKey   && sesSecretKey.trim()) data.sesSecretKey = sesSecretKey
      if (sesFrom        !== undefined) data.sesFrom        = sesFrom
      if (sesConfigSet   !== undefined) data.sesConfigSet   = sesConfigSet || null
    } else {
      if (smtpHost  !== undefined) data.smtpHost = smtpHost
      if (smtpPort  !== undefined) data.smtpPort = Number(smtpPort)
      if (smtpUser  !== undefined) data.smtpUser = smtpUser
      if (smtpPass  && smtpPass.trim()) data.smtpPass = smtpPass
      if (smtpFrom  !== undefined) data.smtpFrom = smtpFrom
    }

    try {
      await db.organization.update({ where: { id: payload.orgId }, data })
    } catch (err: any) {
      if (err.code === 'P2022' || err.message?.includes('column')) {
        return NextResponse.json(
          { error: 'Ejecutá "npx prisma migrate dev" para activar Amazon SES' },
          { status: 400 },
        )
      }
      throw err
    }

    return NextResponse.json({ message: 'Configuración de email guardada' })
  } catch (error) {
    console.error('[EMAIL SETTINGS PATCH]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
