// Helper genérico para números secuenciales legibles por organización (ej.
// "Pedido 001", igual idea que "Ticket #47"). Extrae el patrón "leer el
// máximo actual + intentar crear + reintentar contra el unique constraint"
// que hoy está duplicado 4 veces (api/tickets/route.ts,
// whatsapp-bot/tools.ts ×3) — nuevo uso en el Módulo 3 (Pedido.number), sin
// tocar esas 4 copias existentes en esta pasada (fuera de alcance), pero
// dejando el refactor listo para cuando se haga.
//
// Optimistic retry, no atómico puro — se apoya en un `@@unique([number,
// organizationId])` en el modelo de destino para que una carrera entre dos
// requests simultáneos falle con P2002 en vez de crear un número
// duplicado, y acá se reintenta leyendo el nuevo máximo.
export async function createWithSequence<T>(
  db: Record<string, any>,
  model: string,
  orgId: string,
  createFn: (nextNumber: number) => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const last = await db[model].findFirst({
      where: { organizationId: orgId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    try {
      return await createFn((last?.number ?? 0) + 1)
    } catch (err: any) {
      if (err?.code !== 'P2002' || attempt === maxAttempts - 1) throw err
    }
  }
  throw new Error('createWithSequence: no se pudo asignar un número tras varios intentos')
}
