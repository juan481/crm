// Rubros de organización disponibles. Lista curada a propósito en código (no
// enum de Prisma) — sumar un rubro nuevo el día de mañana es agregar una
// entrada acá, no una migración de DB.
//
// `Organization.vertical` guarda el `id` de una de estas entradas (o null si
// todavía no se eligió). Cualquier plugin/ítem de nav puede declarar
// `verticals?: string[]` para restringirse a un subconjunto — sin declararlo,
// es visible para todos los rubros (así es como Abba no pierde nada al
// introducir este sistema).

export interface Vertical {
  id: string
  label: string
  description: string
}

export const VERTICALS: Vertical[] = [
  {
    id: 'seguridad',
    label: 'Seguridad electrónica',
    description: 'Monitoreo, alarmas, cámaras, instalaciones y servicios de seguridad.',
  },
  {
    id: 'marketing',
    label: 'Agencia de marketing',
    description: 'Retainers, campañas, diseño, contenido y gestión de clientes de marketing.',
  },
]

export function isValidVertical(id: string): boolean {
  return VERTICALS.some((v) => v.id === id)
}

export function getVertical(id: string | null | undefined): Vertical | null {
  if (!id) return null
  return VERTICALS.find((v) => v.id === id) ?? null
}
