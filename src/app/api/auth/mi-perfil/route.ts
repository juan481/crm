import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { name, password } = await req.json()

    const updateData: Record<string, unknown> = {}
    if (name?.trim()) updateData.name = name.trim()

    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
      }
      const supabase = await createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      updateData.forcePasswordChange = false
    }

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, avatarUrl: true },
    })

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('[AUTH/MI-PERFIL]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
