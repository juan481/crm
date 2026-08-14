import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
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

    // Un rol no puede tocar (password, suspensión, etc.) una cuenta de rango
    // MAYOR al propio — sin esto, un ADMIN podía resetear la contraseña,
    // suspender o eliminar a un SUPER_ADMIN. Solo el cambio de `role` en sí
    // ya estaba protegido (línea de abajo), el resto de los campos no.
    if (!canAccess(payload.role, target.role)) {
      return NextResponse.json({ error: 'No podés modificar una cuenta de rango mayor al tuyo' }, { status: 403 })
    }

    const { status, role, forcePasswordChange, newPassword } = await req.json()

    // Sin esto, el ÚNICO SUPER_ADMIN activo de la org podía bajarse su
    // propio rango o suspenderse a sí mismo (DELETE ya bloqueaba
    // autoeliminación, este PATCH no) — dejando la organización sin nadie
    // que pueda tocar el panel de permisos, plugins, marca o crear otro
    // SUPER_ADMIN. No hay "romper vidrio" a nivel plataforma para eso, así
    // que quedaría varada hasta una intervención manual en la base.
    const wouldLoseRank    = target.id === payload.userId && role && role !== 'SUPER_ADMIN'
    const wouldDeactivate  = target.id === payload.userId && status && status !== 'ACTIVE'
    if ((wouldLoseRank || wouldDeactivate) && target.role === 'SUPER_ADMIN') {
      const otherActiveSuperAdmins = await prisma.user.count({
        where: { organizationId: payload.orgId, role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: target.id } },
      })
      if (otherActiveSuperAdmins === 0) {
        return NextResponse.json({ error: 'Sos el único Super Admin activo — no podés bajar tu propio rango ni suspenderte' }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    const VALID_ROLES = ['ADMIN', 'SELLER', 'TECHNICIAN', 'HR', 'SUPER_ADMIN']
    if (role) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
      }
      if (canAccess(payload.role, 'SUPER_ADMIN')) updateData.role = role
    }
    if (forcePasswordChange !== undefined) updateData.forcePasswordChange = forcePasswordChange
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Mínimo 8 caracteres' }, { status: 400 })
      }
      // Reset password in Supabase Auth via admin API
      if (target.supabaseId) {
        const admin = createAdminClient()
        const { error } = await admin.auth.admin.updateUserById(target.supabaseId, {
          password: newPassword,
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      }
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

    const target = await prisma.user.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    if (!canAccess(payload.role, target.role)) {
      return NextResponse.json({ error: 'No podés eliminar una cuenta de rango mayor al tuyo' }, { status: 403 })
    }

    // Remove from Supabase Auth so the email can be reused when recreating the user
    if (target.supabaseId) {
      try {
        const admin = createAdminClient()
        await admin.auth.admin.deleteUser(target.supabaseId)
      } catch (e) {
        console.error('[USER DELETE] Supabase Auth delete failed:', e)
      }
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
