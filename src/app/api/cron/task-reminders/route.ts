import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Digest diario: junta por persona las tareas vencidas o que vencen hoy y
// manda UN email con la lista — no una alerta por tarea. Ver Fase 11 del
// plan. Disparado por Vercel Cron (vercel.json), nunca por un usuario.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const db = prisma as any
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const tasks = await db.task.findMany({
      where: {
        status: { not: 'HECHA' },
        dueDate: { lte: endOfToday, not: null },
      },
      select: {
        id: true, title: true, dueDate: true, organizationId: true,
        assignedTo: { select: { id: true, name: true, email: true } },
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

      const byUser = new Map<string, { name: string; email: string; tasks: typeof orgTasks }>()
      for (const t of orgTasks) {
        if (!t.assignedTo?.email) continue
        const key = t.assignedTo.id
        if (!byUser.has(key)) byUser.set(key, { name: t.assignedTo.name, email: t.assignedTo.email, tasks: [] })
        byUser.get(key)!.tasks.push(t)
      }

      const orgName = org?.name || org?.crmName || 'CRM'
      for (const { name, email, tasks: userTasks } of Array.from(byUser.values())) {
        const overdue = userTasks.filter((t: any) => new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0)))
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

    return NextResponse.json({ ok: true, emailsSent, orgsSkipped, orgsProcessed: byOrg.size })
  } catch (error) {
    console.error('[CRON TASK-REMINDERS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
