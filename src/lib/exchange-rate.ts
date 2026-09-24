import { unstable_cache } from 'next/cache'

export interface DolarRate {
  venta: number
  compra: number
  updatedAt: string
}

// Dólar "oficial" (dolarapi.com) — en la práctica es el tipo de cambio
// vendedor que public el Banco Nación (BNA es la referencia del oficial en
// Argentina), así que se usa como el "TC BNA Vendedor" que pide Abba para
// las cotizaciones en USD. Cacheado 30 min server-side (unstable_cache) —
// mismo criterio que /api/exchange-rate, que reusa este helper.
export const getOfficialUsdRate = unstable_cache(
  async (): Promise<DolarRate> => {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
      headers: { 'User-Agent': 'JustCRM/1.0' },
      next: { revalidate: 1800 },
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
  { revalidate: 1800 },
)
