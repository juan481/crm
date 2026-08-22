import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { QUICK_ACTION_POOL } from '@/lib/quick-actions'

// Fire-and-forget desde el cliente cada vez que se usa una acción de la
// Barra Rápida (tap en Fichar/Buscar) o se navega a una de las pantallas
// candidatas de su pool (ver app-shell.tsx) — es la señal de "uso real"
// que después ordena src/lib/quick-actions.ts. Nunca debe bloquear ni
// mostrar error al usuario si falla: es telemetría de UX, no una acción
// que el usuario pidió explícitamente.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const actionKey = body?.actionKey
    if (typeof actionKey !== 'string' || !actionKey) {
      return NextResponse.json({ error: 'actionKey requerido' }, { status: 400 })
    }
    // Validado contra el pool del rol — no contra una lista global de
    // actionKeys válidos, así un actionKey real pero ajeno al rol actual
    // (ej. alguien manda 'facturas' siendo Técnico) no ensucia el conteo
    // con algo que ese rol nunca va a poder ver en su propia barra.
    const pool = QUICK_ACTION_POOL[payload.role]
    if (!pool || !pool.includes(actionKey)) {
      return NextResponse.json({ ok: true }) // silencioso — ver comentario de arriba
    }

    const db = prisma as any
    await db.quickActionUsage.upsert({
      where: { userId_actionKey: { userId: payload.userId, actionKey } },
      update: { count: { increment: 1 }, lastUsedAt: new Date() },
      create: { userId: payload.userId, organizationId: payload.orgId, actionKey },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[QUICK ACTIONS TRACK]', error)
    // 200 igual — un fallo acá nunca debe verse como un error real en la UI.
    return NextResponse.json({ ok: false })
  }
}
