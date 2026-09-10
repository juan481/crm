import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Callback del enlace de acceso del Portal de Clientes.
//  - token_hash → enlace generado por nosotros (admin.generateLink + verifyOtp)
//  - code       → flujo PKCE (compat)
// Verifica que el usuario sea un CLIENTE activo con Empresa antes de dejar
// entrar; si no, cierra la sesión.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const tokenHash = url.searchParams.get('token_hash')
  const code = url.searchParams.get('code')
  const loginUrl = new URL('/portal/login', url.origin)

  const supabase = await createClient()
  let userId: string | undefined

  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (error || !data.session?.user) {
      loginUrl.searchParams.set('error', 'link')
      return NextResponse.redirect(loginUrl)
    }
    userId = data.session.user.id
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.session?.user) {
      loginUrl.searchParams.set('error', 'link')
      return NextResponse.redirect(loginUrl)
    }
    userId = data.session.user.id
  } else {
    loginUrl.searchParams.set('error', 'link')
    return NextResponse.redirect(loginUrl)
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: userId },
    select: { role: true, status: true, empresaId: true },
  })

  if (!dbUser || dbUser.role !== 'CLIENTE' || dbUser.status !== 'ACTIVE' || !dbUser.empresaId) {
    await supabase.auth.signOut()
    loginUrl.searchParams.set('error', 'denied')
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.redirect(new URL('/portal', url.origin))
}
