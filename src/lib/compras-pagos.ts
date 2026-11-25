// Helpers de pagos a proveedores (Compras) — sin Prisma, se usan en server y
// en client.
//
// Pedido de Seba (Abba, 2026-11-24): a los proveedores se les paga casi
// siempre con varios cheques diferidos. Un CompraPago con fecha >= hoy es un
// cheque / pago programado "a debitar": la deuda con el proveedor ya está
// cubierta, pero la plata todavía no salió. "Por pagar" los muestra como
// calendario de salidas, no los esconde.

// ─── Fechas "de día" (sin hora) ────────────────────────────────────────────
// Un <input type="date"> manda "2026-11-20". `new Date("2026-11-20")` es
// medianoche UTC = 19/11 21:00 en Argentina → la pantalla mostraba un día
// menos. Se guardan al mediodía UTC y se muestran en UTC: el día no se corre
// para ningún huso de -11 a +11, y los registros viejos (medianoche UTC)
// también se leen bien.

export function parseFechaDia(v: unknown): Date | null {
  if (typeof v !== 'string' || !v.trim()) return null
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`)
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t)
}

export function fmtDia(iso: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { timeZone: 'UTC', ...opts })
}

// "YYYY-MM-DD" del día de una fecha guardada (ver parseFechaDia).
export function diaDe(iso: string | Date): string {
  return (typeof iso === 'string' ? new Date(iso) : iso).toISOString().slice(0, 10)
}

// Hoy en Argentina, "YYYY-MM-DD" (el server de Vercel corre en UTC).
export function hoyAR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
}

export function sumarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000)
}

// ─── Saldo ─────────────────────────────────────────────────────────────────
// Dividir un total en cheques deja centavos sueltos (1.114.414,29 en dos
// cheques de 557.207 → saldo 0,29 y la compra quedaba "pago parcial" para
// siempre). Menos de 1 peso (o 1 centavo en otras monedas) = pagada.
export function toleranciaSaldo(moneda: string | null | undefined): number {
  return (moneda ?? 'ARS').toUpperCase() === 'ARS' ? 1 : 0.01
}

export function saldoCompra(total: number, pagado: number, moneda: string | null | undefined): number {
  const s = total - pagado
  return s < toleranciaSaldo(moneda) ? 0 : Math.round(s * 100) / 100
}

export function estadoPagoPara(total: number, pagado: number, moneda: string | null | undefined): 'PENDIENTE' | 'PARCIAL' | 'PAGADA' {
  if (pagado <= 0) return total <= 0 ? 'PAGADA' : 'PENDIENTE'
  return saldoCompra(total, pagado, moneda) === 0 ? 'PAGADA' : 'PARCIAL'
}

// Reparte `total` en `n` pagos iguales al centavo; el último absorbe la
// diferencia de redondeo para que la suma dé exacto.
export function dividirEnCuotas(total: number, n: number): number[] {
  const cuotas = Math.max(1, Math.floor(n))
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / cuotas)
  return Array.from({ length: cuotas }, (_, i) => (i === cuotas - 1 ? cents - base * (cuotas - 1) : base) / 100)
}

export interface PagoInput {
  monto: number
  fecha: Date
  medio: string | null
  nota: string | null
}

// Normaliza los pagos que manda la pantalla de carga. Ignora filas vacías.
export function normalizarPagos(raw: unknown): PagoInput[] {
  if (!Array.isArray(raw)) return []
  const out: PagoInput[] = []
  for (const p of raw as any[]) {
    const monto = typeof p?.monto === 'string' ? Number(p.monto.replace(',', '.')) : Number(p?.monto)
    if (!Number.isFinite(monto) || monto <= 0) continue
    out.push({
      monto: Math.round(monto * 100) / 100,
      fecha: parseFechaDia(p?.fecha) ?? parseFechaDia(hoyAR())!,
      medio: typeof p?.medio === 'string' && p.medio.trim() ? p.medio.trim().slice(0, 40) : null,
      nota: typeof p?.nota === 'string' && p.nota.trim() ? p.nota.trim().slice(0, 200) : null,
    })
  }
  return out
}
