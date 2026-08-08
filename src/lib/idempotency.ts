import { prisma } from '@/lib/db'

// "Reserva" la corrida de un cron para (job, org, día) — ver modelo CronRun.
// Devuelve true la primera vez (seguí y mandá el aviso), false si ya corrió
// para ese día (Vercel reintentó la invocación, o se disparó a mano dos
// veces) — no manda nada de nuevo. Se apoya en el @@unique del modelo, no
// en un SELECT-then-INSERT (evita una carrera entre dos invocaciones
// simultáneas del mismo cron).
export async function claimCronRun(jobName: string, orgId: string, forDate: Date): Promise<boolean> {
  const db = prisma as any
  try {
    await db.cronRun.create({ data: { jobName, orgId, forDate } })
    return true
  } catch (err: any) {
    if (err.code === 'P2002') return false
    throw err
  }
}
