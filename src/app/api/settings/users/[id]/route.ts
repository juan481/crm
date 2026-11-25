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

    const { status, role, forcePasswordChange, newPassword, verTodoPipeline } = await req.json()

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
    const VALID_ROLES = ['ADMIN', 'ADMINISTRATIVO', 'SELLER', 'TECHNICIAN', 'HR', 'SUPER_ADMIN', 'GREMIO']
    if (role) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
      }
      if (canAccess(payload.role, 'SUPER_ADMIN')) updateData.role = role
    }
    if (forcePasswordChange !== undefined) updateData.forcePasswordChange = forcePasswordChange
    // Sólo tiene efecto real en SELLER (ver comentario en schema.prisma) pero
    // no hace falta restringir el PATCH a ese rol — guardarlo en cualquier
    // otro rol es inofensivo, simplemente no se lee.
    if (verTodoPipeline !== undefined) updateData.verTodoPipeline = verTodoPipeline === true
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
      select: { id: true, email: true, name: true, role: true, status: true, forcePasswordChange: true, verTodoPipeline: true },
    })

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('[USER PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

// Lo que un usuario tiene "abierto" a su nombre — al eliminarlo, si nadie lo
// toma, queda colgado de una cuenta que ya no existe (deals que no aparecen
// en el filtro por vendedor, tareas que nadie ve en Mi Día, tickets sin
// atender). Pedido de Abba (Seba, 2026-11-02): poder eliminar usuarios de
// verdad, sin perder lo que tenían.
const OPEN_DEAL = { stage: { notIn: ['GANADO', 'PERDIDO'] } }
const OPEN_TASK = { status: { not: 'HECHA' } }
const OPEN_TICKET = { status: { in: ['ABIERTO', 'EN_PROCESO', 'ESPERANDO'] } }
const OPEN_PEDIDO = { status: { in: ['PENDIENTE', 'CONFIRMADO'] } }

async function pendientesDe(db: any, userId: string, orgId: string) {
  const scope = { organizationId: orgId }
  const [deals, empresas, tareas, tickets, pedidos] = await Promise.all([
    db.deal.count({ where: { ...scope, ownerId: userId, ...OPEN_DEAL } }),
    db.empresa.count({ where: { ...scope, ownerId: userId } }),
    db.task.count({ where: { ...scope, assignedToId: userId, ...OPEN_TASK } }),
    db.ticket.count({ where: { ...scope, assignedToId: userId, ...OPEN_TICKET } }),
    db.pedido.count({ where: { ...scope, assignedToId: userId, ...OPEN_PEDIDO } }),
  ])
  return { deals, empresas, tareas, tickets, pedidos }
}

// GET — resumen de lo que tiene abierto (para el modal de "Eliminar").
export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    const target = await prisma.user.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, name: true, role: true },
    })
    if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    const pendientes = await pendientesDe(prisma as any, target.id, payload.orgId)
    return NextResponse.json({ data: { ...target, pendientes } })
  } catch (error) {
    console.error('[USER GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE ?reasignarA=<userId> — baja lógica (status DELETED: se conserva la
// fila para no romper el historial de notas/cotizaciones/actividad que la
// referencian) + borra el login de Supabase Auth. Con reasignarA, antes le
// pasa a ese usuario sus oportunidades abiertas, empresas, tareas
// pendientes, tickets abiertos y pedidos en curso. Lo cerrado (deals
// ganados/perdidos, tareas hechas, tickets resueltos) queda a su nombre a
// propósito: es historia, y las comisiones ya calculadas no se mueven.
export async function DELETE(req: NextRequest, { params }: Params) {
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

    // Mismo resguardo que el PATCH: no dejar la organización sin ningún
    // Super Admin activo.
    if (target.role === 'SUPER_ADMIN' && target.status === 'ACTIVE') {
      const otros = await prisma.user.count({
        where: { organizationId: payload.orgId, role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: target.id } },
      })
      if (otros === 0) return NextResponse.json({ error: 'Es el único Super Admin activo — no se puede eliminar' }, { status: 400 })
    }

    const reasignarA = req.nextUrl.searchParams.get('reasignarA')
    let receptor: { id: string; role: string } | null = null
    if (reasignarA) {
      if (reasignarA === target.id) return NextResponse.json({ error: 'Elegí a otro usuario para pasarle sus cosas' }, { status: 400 })
      receptor = await prisma.user.findFirst({
        where: { id: reasignarA, organizationId: payload.orgId, status: 'ACTIVE', role: { notIn: ['GREMIO', 'CLIENTE', 'SUPPORT_EXTERNAL'] } },
        select: { id: true, role: true },
      })
      if (!receptor) return NextResponse.json({ error: 'El usuario elegido para recibir sus cosas no está activo' }, { status: 400 })
    }

    const db = prisma as any
    const movidos = await db.$transaction(async (tx: any) => {
      let res = { deals: 0, empresas: 0, tareas: 0, tickets: 0, pedidos: 0 }
      if (receptor) {
        const scope = { organizationId: payload.orgId }
        const [deals, empresas, tareas, tickets, pedidos] = await Promise.all([
          tx.deal.updateMany({ where: { ...scope, ownerId: target.id, ...OPEN_DEAL }, data: { ownerId: receptor.id } }),
          tx.empresa.updateMany({ where: { ...scope, ownerId: target.id }, data: { ownerId: receptor.id } }),
          tx.task.updateMany({ where: { ...scope, assignedToId: target.id, ...OPEN_TASK }, data: { assignedToId: receptor.id } }),
          tx.ticket.updateMany({ where: { ...scope, assignedToId: target.id, ...OPEN_TICKET }, data: { assignedToId: receptor.id } }),
          tx.pedido.updateMany({ where: { ...scope, assignedToId: target.id, ...OPEN_PEDIDO }, data: { assignedToId: receptor.id } }),
        ])
        res = { deals: deals.count, empresas: empresas.count, tareas: tareas.count, tickets: tickets.count, pedidos: pedidos.count }
      }
      await tx.user.update({
        where: { id: target.id },
        data: {
          status: 'DELETED',
          // User.email es @unique en TODA la base: si la fila borrada se
          // queda con el mail, volver a crear a esa persona con el mismo
          // email reventaba en el create (500 "Error al crear usuario")
          // aunque el chequeo de duplicados ignore los DELETED. Se libera
          // renombrándolo. Los accesos de portal (CLIENTE) NO: su flujo de
          // "volver a dar acceso" (empresas/[id]/portal-acceso) reactiva la
          // misma fila buscándola por email.
          ...(target.role !== 'CLIENTE' && !target.email.startsWith('eliminado-') && {
            email: `eliminado-${target.id}+${target.email}`,
          }),
        },
      })
      return res
    })

    // Login fuera recién después de confirmada la baja (si la transacción
    // falla, el usuario sigue pudiendo entrar como antes).
    if (target.supabaseId) {
      try {
        const admin = createAdminClient()
        await admin.auth.admin.deleteUser(target.supabaseId)
      } catch (e) {
        console.error('[USER DELETE] Supabase Auth delete failed:', e)
      }
    }

    return NextResponse.json({ message: 'Usuario eliminado', data: { movidos } })
  } catch (error) {
    console.error('[USER DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
