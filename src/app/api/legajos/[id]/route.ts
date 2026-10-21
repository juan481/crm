import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { deleteDocumentsFromStorage } from '@/lib/document-storage'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const vigilador = await db.vigilador.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        documentos: { orderBy: { createdAt: 'desc' } },
        cursos: { orderBy: { fecha: 'desc' } },
        turnos: { orderBy: { fecha: 'desc' }, take: 30 },
      },
    })
    if (!vigilador) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    return NextResponse.json({ data: vigilador })
  } catch (error) {
    console.error('[LEGAJO GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const existing = await db.vigilador.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const body = await req.json()
    const { nombre, apellido, dni, fechaIngreso, carnetVencimiento, art, lugarTrabajo, activo, notas } = body

    try {
      const vigilador = await db.vigilador.update({
        where: { id: params.id },
        data: {
          ...(nombre !== undefined && { nombre: nombre.trim() }),
          ...(apellido !== undefined && { apellido: apellido.trim() }),
          ...(dni !== undefined && { dni: dni.trim() }),
          // Campos @db.Date — ver comentario en POST /api/legajos: el
          // bug de desplazamiento de día está en la lectura/display, no
          // en cómo se guarda acá.
          ...(fechaIngreso !== undefined && { fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null }),
          ...(carnetVencimiento !== undefined && { carnetVencimiento: carnetVencimiento ? new Date(carnetVencimiento) : null }),
          ...(art !== undefined && { art: art?.trim() || null }),
          ...(lugarTrabajo !== undefined && { lugarTrabajo: lugarTrabajo?.trim() || null }),
          ...(activo !== undefined && { activo: !!activo }),
          ...(notas !== undefined && { notas: notas?.trim() || null }),
        },
      })
      return NextResponse.json({ data: vigilador })
    } catch (err: any) {
      if (err?.code === 'P2002' && err?.meta?.target?.includes?.('dni')) {
        return NextResponse.json({ error: 'Ya existe un legajo con ese DNI' }, { status: 409 })
      }
      throw err
    }
  } catch (error) {
    console.error('[LEGAJO PATCH]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // Borrar un legajo (no sólo editarlo) queda para ADMIN+ — mismo criterio
    // que Contactos/Empresas (roleHasModule alcanza para ver/editar, borrar
    // pide más). Las dos condiciones, no sólo la jerarquía: si un Super
    // Admin le apaga 'legajos' a ADMIN desde Permisos, ADMIN pierde GET/
    // PATCH (que sí chequean roleHasModule) pero sin este chequeo acá
    // conservaba el DELETE (bug real encontrado en code-review).
    if (!canAccess(payload.role, 'ADMIN') || !(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    // onDelete: Cascade borra las filas de Document/VigiladorCurso/
    // VigiladorTurno en la DB, pero NUNCA toca el storage real — sin esto
    // los archivos subidos (DNI/carnet/contrato) quedaban huérfanos en
    // Supabase para siempre (bug real encontrado en code-review). Se
    // borran del storage ANTES de borrar la fila (si el delete de abajo
    // fallara, preferible un archivo huérfano a una fila huérfana).
    const documentos = await db.document.findMany({
      where: { legajoId: params.id, organizationId: payload.orgId },
      select: { storagePath: true, url: true },
    })
    await deleteDocumentsFromStorage(documentos)

    const result = await db.vigilador.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    if (result.count === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    return NextResponse.json({ message: 'Legajo eliminado' })
  } catch (error) {
    console.error('[LEGAJO DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
