import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { getPluginConfig, isPluginEnabled } from '@/lib/plugins'
import { syncCatalogFromGoogleSheet } from '@/lib/catalogo-sync'

export const dynamic = 'force-dynamic'
// Ver mismo comentario en api/cron/catalogo-sync/route.ts — una primera
// corrida completa (o un catálogo grande) puede tardar varios minutos.
export const maxDuration = 300

// Disparo manual del sync de catálogo ("Sincronizar ahora" en
// /configuracion/catalogo) — mismo `syncCatalogFromGoogleSheet()` que usa
// el cron (api/cron/catalogo-sync), sólo que para la organización del
// usuario logueado en vez de recorrer todas.
export async function POST() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    if (!(await isPluginEnabled(payload.orgId, 'catalogo-google-sheets'))) {
      return NextResponse.json(
        { error: 'El plugin "Catálogo · Sync con Google Sheets" no está activado. Activalo desde Configuración > Plugins.' },
        { status: 400 }
      )
    }
    const config = (await getPluginConfig(payload.orgId, 'catalogo-google-sheets')) as
      | { sheetId?: string; sheetTabName?: string }
      | null
    if (!config) {
      return NextResponse.json({ error: 'Falta configurar el ID del Sheet en el plugin.' }, { status: 400 })
    }

    const result = await syncCatalogFromGoogleSheet(payload.orgId, config)
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[CATALOGO SYNC]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
