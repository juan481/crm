import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

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
