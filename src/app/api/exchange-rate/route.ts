import { NextResponse } from 'next/server'
import { getCurrentUserAny } from '@/lib/auth'
import { getOfficialUsdRate } from '@/lib/exchange-rate'

export async function GET() {
  try {
    // Antes esta ruta se apoyaba SOLO en el middleware para exigir sesión
    // (no tenía chequeo propio). Con /api/* saltando el paso de Supabase en
    // el middleware (ver src/middleware.ts) por latencia, cada ruta necesita
    // su propio guard — este es el único caso que no lo tenía.
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const rate = await getOfficialUsdRate()
    return NextResponse.json(
      { data: rate },
      { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } }
    )
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener el tipo de cambio' },
      { status: 503 }
    )
  }
}
