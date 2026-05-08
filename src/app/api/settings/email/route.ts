import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { testSmtp, type SmtpConfig } from '@/lib/email'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpFrom: true },
    })

    // Never return the password in GET
    return NextResponse.json({
      data: {
        smtpHost: org?.smtpHost ?? '',
        smtpPort: org?.smtpPort ?? 587,
        smtpUser: org?.smtpUser ?? '',
        smtpFrom: org?.smtpFrom ?? '',
        hasPassword: !!(await prisma.organization.findUnique({
          where: { id: payload.orgId },
          select: { smtpPass: true },
        }))?.smtpPass,
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

    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, test } = await req.json()

    if (test) {
      if (!smtpHost || !smtpUser || !smtpPass) {
        return NextResponse.json({ error: 'Completa host, usuario y contraseña para probar' }, { status: 400 })
      }
      const result = await testSmtp({
        host: smtpHost,
        port: Number(smtpPort) || 587,
        user: smtpUser,
        pass: smtpPass,
        from: smtpFrom || smtpUser,
      })
      return NextResponse.json({ ok: result.ok, error: result.error })
    }

    await prisma.organization.update({
      where: { id: payload.orgId },
      data: {
        ...(smtpHost !== undefined && { smtpHost }),
        ...(smtpPort !== undefined && { smtpPort: Number(smtpPort) }),
        ...(smtpUser !== undefined && { smtpUser }),
        ...(smtpPass && { smtpPass }),
        ...(smtpFrom !== undefined && { smtpFrom }),
      },
    })

    return NextResponse.json({ message: 'Configuración de email guardada' })
  } catch (error) {
    console.error('[EMAIL SETTINGS PATCH]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
