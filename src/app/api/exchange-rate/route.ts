import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getCurrentUserAny } from '@/lib/auth'

interface DolarRate {
  venta: number
  compra: number
  updatedAt: string
}

const fetchOfficialRate = unstable_cache(
  async (): Promise<DolarRate> => {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
      headers: { 'User-Agent': 'JustCRM/1.0' },
      next: { revalidate: 1800 }, // Next.js fetch cache: 30 min
    })
    if (!res.ok) throw new Error('dolarapi unavailable')
    const data = await res.json()
    return {
      venta: Number(data.venta),
      compra: Number(data.compra),
      updatedAt: data.fechaActualizacion ?? new Date().toISOString(),
    }
  },
  ['dolar-oficial'],
  { revalidate: 1800 } // unstable_cache: 30 min
)

export async function GET() {
  try {
    // Antes esta ruta se apoyaba SOLO en el middleware para exigir sesión
    // (no tenía chequeo propio). Con /api/* saltando el paso de Supabase en
    // el middleware (ver src/middleware.ts) por latencia, cada ruta necesita
    // su propio guard — este es el único caso que no lo tenía.
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const rate = await fetchOfficialRate()
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
