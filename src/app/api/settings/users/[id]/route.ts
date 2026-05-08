import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const target = await prisma.user.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const { status, role, forcePasswordChange, newPassword } = await req.json()

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (role && canAccess(payload.role, 'SUPER_ADMIN')) updateData.role = role
    if (forcePasswordChange !== undefined) updateData.forcePasswordChange = forcePasswordChange
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Mínimo 8 caracteres' }, { status: 400 })
      }
      updateData.passwordHash = await hashPassword(newPassword)
      updateData.forcePasswordChange = true
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, status: true, forcePasswordChange: true },
    })

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('[USER PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    if (params.id === payload.userId) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: params.id },
      data: { status: 'DELETED' },
    })

    return NextResponse.json({ message: 'Usuario eliminado' })
  } catch (error) {
    console.error('[USER DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
