import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { getPluginConfig, isPluginEnabled } from '@/lib/plugins'
import { syncCatalogFromGoogleSheet, type CatalogSyncResult } from '@/lib/catalogo-sync'

export const dynamic = 'force-dynamic'
// Pide el máximo que Vercel permita en el plan contratado (lo recorta solo
// si el plan es más chico, no falla por pedirlo) — recorrer varias
// organizaciones con miles de SKUs cada una puede tardar varios minutos
// incluso con los upserts en paralelo (ver UPSERT_CONCURRENCY en
// catalogo-sync.ts) y la latencia ya documentada Vercel↔Supabase.
export const maxDuration = 300

// Sync recurrente del catálogo (cada 4hs, ver vercel.json) para toda
// organización con el plugin "catalogo-google-sheets" activo. No usa
// claimCronRun/CronRun (idempotencia de "una vez por día") a propósito — a
// diferencia de un mail, el upsert por SKU es idempotente por diseño:
// correrlo de nuevo en la misma ventana no duplica ni rompe nada, así que
// no hace falta impedirlo.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })
    const results: Record<string, CatalogSyncResult> = {}
    let orgsSynced = 0
    let orgsSkippedDisabled = 0

    for (const org of orgs) {
      if (!(await isPluginEnabled(org.id, 'catalogo-google-sheets'))) { orgsSkippedDisabled++; continue }

      const config = (await getPluginConfig(org.id, 'catalogo-google-sheets')) as
        | { sheetId?: string; sheetTabName?: string }
        | null
      if (!config) continue

      const result = await syncCatalogFromGoogleSheet(org.id, config)
      results[org.name] = result
      if (result.ok) orgsSynced++
    }

    return NextResponse.json({ ok: true, orgsSynced, orgsSkippedDisabled, results })
  } catch (error) {
    console.error('[CRON CATALOGO-SYNC]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
