import { ROLE_LABELS } from '@/lib/utils'

// Nombres de rol por rubro — sólo cambia CÓMO se llama un rol en pantalla,
// nunca el enum de Prisma ni la jerarquía de permisos (canAccess en
// src/lib/auth.ts sigue intacta). Sin entrada para un rubro/rol = se usa
// ROLE_LABELS (el de siempre) — así Abba no ve ningún cambio.
const OVERRIDES_BY_VERTICAL: Record<string, Partial<Record<string, string>>> = {
  marketing: {
    SELLER: 'Account Manager',
    TECHNICIAN: 'Creativo',
  },
}

export function getRoleLabel(role: string, vertical: string | null | undefined): string {
  const override = vertical ? OVERRIDES_BY_VERTICAL[vertical]?.[role] : undefined
  return override ?? ROLE_LABELS[role] ?? role
}
