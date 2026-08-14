import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { claimCronRun } from '@/lib/idempotency'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { argentinaDayStart, argentinaTimeToInstant } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

const JOB_NAME = 'task-reminders'

// Digest diario: junta por persona las tareas vencidas o que vencen hoy y
// manda UN email con la lista — no una alerta por tarea. Ver Fase 11 del
// plan. Disparado por Vercel Cron (vercel.json), nunca por un usuario.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Modo prueba: corre exactamente las mismas queries (para confirmar que
  // encuentra a la gente correcta), pero no manda ningún mail real ni
  // reclama el CronRun del día — así no interfiere con la corrida real de
  // hoy/mañana. Pensado para verificar que CRON_SECRET quedó bien
  // configurado sin efectos sobre gente real. Uso: ?dryRun=1
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  try {
    const db = prisma as any
    // argentinaDayStart/argentinaTimeToInstant, no getters/setters "locales"
    // de Date — mismo bug que ya se encontró y arregló en
    // attendance-digest (Vercel corre en UTC, no Argentina), que acá nunca
    // se había aplicado. Ver src/lib/timezone.ts.
    const todayStart = argentinaDayStart()
    // Medianoche de mañana (Argentina) menos 1ms = 23:59:59.999 de hoy —
    // más preciso que pasar hours=23/minutes=59 (perdería los últimos 59s).
    const endOfToday = new Date(argentinaTimeToInstant(todayStart, 24, 0).getTime() - 1)

    const tasks = await db.task.findMany({
      where: {
        status: { not: 'HECHA' },
        dueDate: { lte: endOfToday, not: null },
      },
      select: {
        id: true, title: true, dueDate: true, organizationId: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        // Colaboradores adicionales (no obligatorio, ver TaskCollaborator)
        // también reciben el recordatorio, no sólo el asignado principal.
        collaborators: { select: { user: { select: { id: true, name: true, email: true } } } },
      },
    })

    // Agrupa por organización primero (la config de correo es por org) y
    // adentro por persona asignada.
    const byOrg = new Map<string, typeof tasks>()
    for (const t of tasks) {
      if (!byOrg.has(t.organizationId)) byOrg.set(t.organizationId, [])
      byOrg.get(t.organizationId)!.push(t)
    }

    let emailsSent = 0
    let orgsSkipped = 0
    let orgsSkippedAlreadySent = 0
    const wouldSend: { org: string; name: string; email: string; tasks: number }[] = []
    const today = todayStart

    for (const [orgId, orgTasks] of Array.from(byOrg.entries())) {
      const org = await db.organization.findUnique({
        where: { id: orgId },
        select: {
          name: true, crmName: true, primaryColor: true, secondaryColor: true,
          smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
          smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
        },
      })
      if (!isOrgEmailConfigured(org)) { orgsSkipped++; continue }

      // Idempotencia: ya se mandó el digest de hoy para esta org (reintento
      // de Vercel, o disparo manual duplicado) — no se manda de nuevo. Ver
      // modelo CronRun. En dry run no se reclama nada, a propósito.
      if (!dryRun && !(await claimCronRun(JOB_NAME, orgId, today))) { orgsSkippedAlreadySent++; continue }

      // Asignado principal + cada colaborador — una tarea con más de una
      // persona le llega a todos, no sólo al asignado principal (dedupeado
      // por si alguien quedó como colaborador Y asignado a la vez, aunque
      // la API ya evita guardar esa combinación).
      const byUser = new Map<string, { name: string; email: string; tasks: typeof orgTasks }>()
      for (const t of orgTasks) {
        const recipients = [t.assignedTo, ...t.collaborators.map((c: { user: typeof t.assignedTo }) => c.user)]
          .filter((u): u is NonNullable<typeof u> => !!u?.email)
        const seen = new Set<string>()
        for (const u of recipients) {
          if (seen.has(u.id)) continue
          seen.add(u.id)
          if (!byUser.has(u.id)) byUser.set(u.id, { name: u.name, email: u.email, tasks: [] })
          byUser.get(u.id)!.tasks.push(t)
        }
      }

      const orgName = org?.name || org?.crmName || 'CRM'
      for (const { name, email, tasks: userTasks } of Array.from(byUser.values())) {
        const overdue = userTasks.filter((t: any) => new Date(t.dueDate) < todayStart)
        const dueToday = userTasks.filter((t: any) => !overdue.includes(t))
        const lines = [
          ...overdue.map((t: any) => `⚠️ VENCIDA — ${t.title}`),
          ...dueToday.map((t: any) => `• Vence hoy — ${t.title}`),
        ].join('\n')

        const html = buildEmailHtml(
          `Tenés ${userTasks.length} tarea${userTasks.length !== 1 ? 's' : ''} pendiente${userTasks.length !== 1 ? 's' : ''}`,
          `Hola ${name},\n\n${lines}\n\nEntrá al CRM para verlas.`,
          orgName,
          org?.primaryColor || '#6366f1',
          org?.secondaryColor || '#8b5cf6',
        )

        if (dryRun) {
          wouldSend.push({ org: orgName, name, email, tasks: userTasks.length })
          continue
        }

        try {
          await sendEmail({
            to: email,
            subject: `${userTasks.length} tarea${userTasks.length !== 1 ? 's' : ''} pendiente${userTasks.length !== 1 ? 's' : ''} — ${orgName}`,
            html,
            smtpConfig: resolveOrgSmtpConfig(org),
          })
          emailsSent++
        } catch (err) {
          console.error('[CRON TASK-REMINDERS] Error enviando a', email, err)
        }
      }
    }

    return NextResponse.json({
      ok: true, dryRun, emailsSent, orgsSkipped, orgsSkippedAlreadySent, orgsProcessed: byOrg.size,
      ...(dryRun ? { wouldSend } : {}),
    })
  } catch (error) {
    console.error('[CRON TASK-REMINDERS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
