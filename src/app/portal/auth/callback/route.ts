import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Callback del magic link del Portal de Clientes. Supabase redirige acá con
// ?code=... (PKCE). Se canjea por sesión y se verifica que el usuario sea
// realmente un CLIENTE activo con Empresa asignada — si no, se cierra la
// sesión y se lo manda de vuelta al login (no se le deja una sesión útil).
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const loginUrl = new URL('/portal/login', url.origin)

  if (!code) {
    loginUrl.searchParams.set('error', 'link')
    return NextResponse.redirect(loginUrl)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session?.user) {
    loginUrl.searchParams.set('error', 'link')
    return NextResponse.redirect(loginUrl)
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: data.session.user.id },
    select: { role: true, status: true, empresaId: true },
  })

  if (!dbUser || dbUser.role !== 'CLIENTE' || dbUser.status !== 'ACTIVE' || !dbUser.empresaId) {
    await supabase.auth.signOut()
    loginUrl.searchParams.set('error', 'denied')
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.redirect(new URL('/portal', url.origin))
}
