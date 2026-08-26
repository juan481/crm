import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAny } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Ahora sí se usa (antes este endpoint no lo llamaba nadie — el logout real
// pasaba por el cliente, ver useAuthStore().logout()). Se movió acá porque
// necesitamos loguear el LOGOUT mientras la sesión TODAVÍA es válida (una
// vez hecho signOut ya no hay payload que atribuirle el evento), y porque
// hacer el signOut server-side es más confiable — limpia las cookies desde
// la respuesta en vez de depender del cliente.
// getCurrentUserAny() (no getCurrentUser()) — mismo motivo que
// api/auth/log-login/route.ts: sólo escribe el propio evento del usuario
// que llama, GREMIO tiene que poder registrarlo igual que cualquier rol.
export async function POST(req: NextRequest) {
  const payload = await getCurrentUserAny()
  if (payload) {
    try {
      const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
      const userAgent = req.headers.get('user-agent') || null
      await (prisma as any).loginEvent.create({
        data: { userId: payload.userId, organizationId: payload.orgId, type: 'LOGOUT', ipAddress, userAgent },
      })
    } catch (error) {
      console.error('[LOG LOGOUT]', error)
      // No bloquea el logout en sí — mejor cerrar sesión sin el registro
      // que dejar a alguien trabado adentro del CRM por esto.
    }
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ message: 'Sesión cerrada' })
}
