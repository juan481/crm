import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserAny } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

// getCurrentUserAny() (no getCurrentUser()) — CRÍTICO, encontrado en
// auditoría con un browser real: esta ruta sólo toca el propio registro
// del que llama (where: { id: payload.userId }), nunca datos de otro
// usuario, así que es segura para cualquier rol. /cambiar-contrasena (la
// pantalla a la que se redirige a TODA cuenta con forcePasswordChange,
// incluido un usuario Gremio recién creado por un ADMIN) llama
// exclusivamente a esta ruta para fijar la contraseña nueva — con
// getCurrentUser() (que excluye GREMIO desde el fix de seguridad del
// Módulo 3), esa cuenta quedaba trabada para siempre en
// /cambiar-contrasena sin poder salir nunca del loop.
export async function PATCH(req: NextRequest) {
  try {
    const payload = await getCurrentUserAny()
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
