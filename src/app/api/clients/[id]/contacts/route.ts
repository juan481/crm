import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const client = await prisma.client.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const { name, email, phone, whatsapp, role } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const contact = await prisma.contact.create({
      data: {
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        role: role || null,
        clientId: params.id,
      },
    })

    await prisma.activityLog.create({
      data: {
        clientId: params.id,
        userId: payload.userId,
        action: 'CLIENT_UPDATED',
        description: `Contacto "${name}" agregado`,
      },
    })

    return NextResponse.json({ data: contact }, { status: 201 })
  } catch (error) {
    console.error('[CONTACTS POST]', error)
    return NextResponse.json({ error: 'Error al crear contacto' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const contactId = searchParams.get('contactId')
    if (!contactId) return NextResponse.json({ error: 'contactId requerido' }, { status: 400 })

    await prisma.contact.deleteMany({
      where: { id: contactId, clientId: params.id },
    })

    return NextResponse.json({ message: 'Contacto eliminado' })
  } catch (error) {
    console.error('[CONTACTS DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar contacto' }, { status: 500 })
  }
}
