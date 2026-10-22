import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/db'

// ABBA FISICA (legajos) — mismo floor que Pipeline/Contactos (roleHasModule
// como OR), pero con su propio módulo: un HR/ADMINISTRATIVO sin 'pipeline'
// prendido igual tiene que poder subir el carnet/DNI/contrato de un
// vigilador.

const MAX_SIZE = 30 * 1024 * 1024 // 30MB
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[DOC UPLOAD] SUPABASE_SERVICE_ROLE_KEY not set')
      return NextResponse.json({ error: 'Storage no configurado. Contacte al administrador.' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folderId') as string | null
    const clientId = formData.get('clientId') as string | null
    const legajoId = formData.get('legajoId') as string | null
    const supersedesId = formData.get('supersedesId') as string | null
    const tagsRaw = formData.get('tags') as string | null
    const tags = tagsRaw ? JSON.parse(tagsRaw) : []

    // SELLER+, o un TECHNICIAN con Pipeline habilitado, ve/usa el
    // repositorio general de Documentos (folderId/clientId). 'legajos' es
    // un permiso INDEPENDIENTE, no un escalón más de ese mismo piso: ni
    // alcanza para el repositorio general, ni queda implícito en él. Sin
    // esto en los dos sentidos, (a) alguien con sólo 'legajos' colaba un
    // clientId y escribía en el repositorio general, y (b) un SELLER sin
    // 'legajos' podía mandar cualquier legajoId de la org y escribirle un
    // documento sin tener ese módulo habilitado — los dos bugs reales
    // encontrados en code-review.
    const [hasPipelineModule, hasLegajoAccess] = await Promise.all([
      roleHasModule(payload.orgId, payload.role, 'pipeline'),
      roleHasModule(payload.orgId, payload.role, 'legajos'),
    ])
    const hasGeneralAccess = canAccess(payload.role, 'SELLER') || hasPipelineModule
    // "Sólo legajos, nada de repositorio general" — distinto de
    // `hasLegajoAccess` a secas (un ADMIN tiene las dos cosas a la vez, y
    // para ÉL las restricciones de abajo no deben aplicar).
    const legajoOnly = !hasGeneralAccess && hasLegajoAccess
    if (!hasGeneralAccess && !hasLegajoAccess)
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    if (legajoOnly && (clientId || folderId))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    if (legajoId && !hasLegajoAccess)
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    if (legajoOnly && !legajoId && !supersedesId)
      return NextResponse.json({ error: 'Falta el legajo' }, { status: 400 })

    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido. Use JPG, PNG, PDF, DOCX, XLSX o TXT' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite de 30MB' }, { status: 400 })
    }

    // Sin esto, un folderId/clientId de OTRA organización se aceptaba igual
    // (el FK de Prisma solo exige que el id exista, no que sea de esta org).
    if (folderId) {
      const folder = await prisma.folder.findFirst({ where: { id: folderId, organizationId: payload.orgId }, select: { id: true } })
      if (!folder) return NextResponse.json({ error: 'Carpeta no encontrada' }, { status: 400 })
    }
    if (clientId) {
      const client = await prisma.client.findFirst({ where: { id: clientId, organizationId: payload.orgId }, select: { id: true } })
      if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 400 })
    }
    if (legajoId) {
      const legajo = await (prisma as any).vigilador.findFirst({ where: { id: legajoId, organizationId: payload.orgId }, select: { id: true } })
      if (!legajo) return NextResponse.json({ error: 'Legajo no encontrado' }, { status: 400 })
    }

    // Resolve the document being replaced, if any — new row becomes v(previous+1)
    let previousVersion = 0
    let inheritedFolderId = folderId
    let inheritedClientId = clientId
    let inheritedLegajoId = legajoId
    let inheritedTags = tags
    if (supersedesId) {
      const previous = await prisma.document.findFirst({
        where: { id: supersedesId, organizationId: payload.orgId },
        select: { version: true, folderId: true, clientId: true, legajoId: true, tags: true, supersededBy: { select: { id: true } } },
      })
      if (!previous) return NextResponse.json({ error: 'El documento que intentás reemplazar no existe' }, { status: 404 })
      if (previous.supersededBy.length > 0) {
        return NextResponse.json({ error: 'Ese documento ya tiene una versión más nueva' }, { status: 409 })
      }
      // Un usuario con sólo 'legajos' no puede "reemplazar" un documento del
      // repositorio general heredando su clientId/folderId por esta vía —
      // sólo puede reemplazar algo que YA era de legajo.
      if (legajoOnly && !previous.legajoId)
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
      previousVersion = previous.version
      inheritedFolderId = folderId ?? previous.folderId
      inheritedClientId = clientId ?? previous.clientId
      inheritedLegajoId = legajoId ?? previous.legajoId
      inheritedTags = tags.length ? tags : JSON.parse(previous.tags || '[]')
      // El chequeo de `legajoId && !hasLegajoAccess` de arriba sólo mira el
      // parámetro CRUDO del request — si vino vacío pero se heredó un
      // legajoId del documento reemplazado, hay que repetir el mismo
      // chequeo contra el heredado (bug real encontrado en code-review: un
      // SELLER sin 'legajos' podía reemplazar un documento de legajo
      // mandando sólo supersedesId, sin legajoId directo).
      if (inheritedLegajoId && !hasLegajoAccess)
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Nunca mezclar los dos mundos, ni siquiera para un ADMIN que tiene
    // ambos accesos — un documento es del repositorio general O de un
    // legajo, nunca las dos cosas. Chequeado sobre los valores YA
    // RESUELTOS (no sólo los crudos del request): reemplazar con
    // supersedesId podía heredar un legajoId de la versión anterior y
    // combinarlo con un clientId nuevo sin que el chequeo anterior (sólo
    // miraba el legajoId crudo) lo viera (bug real encontrado en
    // code-review). Si no, el filtro `legajoId: null` de GET
    // /api/documentos hace desaparecer el documento del folder/cliente al
    // que supuestamente pertenece, aunque siga existiendo.
    if (inheritedLegajoId && (inheritedClientId || inheritedFolderId))
      return NextResponse.json({ error: 'Un documento no puede ser del repositorio general y de un legajo a la vez' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `documents/${payload.orgId}/${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type })

    if (uploadError) {
      console.error('[DOC UPLOAD] Storage error:', uploadError)
      const msg = uploadError.message?.includes('bucket') || uploadError.message?.includes('Bucket')
        ? `Bucket "${BUCKET}" no existe en Supabase Storage. Crealo desde el panel de Supabase.`
        : `Error al subir archivo: ${uploadError.message}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const document = await prisma.document.create({
      data: {
        name: file.name.replace(`.${ext}`, ''),
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: publicUrl,
        storagePath: path,
        folderId: inheritedFolderId || null,
        clientId: inheritedClientId || null,
        legajoId: inheritedLegajoId || null,
        organizationId: payload.orgId,
        tags: JSON.stringify(inheritedTags),
        version: previousVersion + 1,
        supersedesId: supersedesId || null,
        uploadedById: payload.userId,
      },
      include: { uploadedBy: { select: { name: true } } },
    })

    if (inheritedClientId) {
      await prisma.activityLog.create({
        data: {
          clientId: inheritedClientId,
          userId: payload.userId,
          action: 'DOCUMENT_UPLOADED',
          description: `Documento "${file.name}" subido`,
        },
      })
    }

    return NextResponse.json({ data: { ...document, tags: inheritedTags } }, { status: 201 })
  } catch (error: any) {
    // Dos reemplazos casi simultáneos del mismo documento (doble click, dos
    // personas subiendo la versión nueva a la vez): el chequeo de arriba
    // (`previous.supersededBy.length > 0`) puede pasar en ambos requests
    // antes de que cualquiera termine de crear — el @@unique([supersedesId])
    // del schema es la protección real, esto sólo lo convierte en un 409
    // legible en vez de un 500 genérico.
    if (error?.code === 'P2002' && error?.meta?.target?.includes?.('supersedesId')) {
      return NextResponse.json({ error: 'Ese documento ya tiene una versión más nueva' }, { status: 409 })
    }
    console.error('[DOC UPLOAD]', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
