import { NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Mide, en el momento, cuanto tarda de verdad la funcion serverless en
// hablar con la base -- para poder responder "esta lento ahora?" con un
// numero real en vez de una sensacion. Tres tiempos por separado:
//   - ping: SELECT 1 puro, sin tocar ninguna tabla -- es basicamente el
//     costo de red + conexion entre la funcion y Postgres (Vercel<->Supabase).
//   - query: una consulta real contra una tabla -- ping + el trabajo propio
//     de esa query.
//   - total: todo el tiempo del handler, de punta a punta.
// process.env.VERCEL_REGION lo pone Vercel automaticamente en cada funcion
// -- confirma en que region corrio ESTA ejecucion puntual, sin depender de
// leer headers desde afuera.
export async function GET() {
  const t0 = Date.now()
  try {
    const admin = await getPlatformAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const tPingStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const pingMs = Date.now() - tPingStart

    const tQueryStart = Date.now()
    const orgCount = await prisma.organization.count()
    const queryMs = Date.now() - tQueryStart

    const totalMs = Date.now() - t0

    return NextResponse.json({
      data: {
        region: process.env.VERCEL_REGION ?? 'desconocida (no corriendo en Vercel)',
        pingMs,
        queryMs,
        totalMs,
        orgCount,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[ADMIN DIAGNOSTICS]', error)
    return NextResponse.json({ error: 'Error interno', totalMs: Date.now() - t0 }, { status: 500 })
  }
}
