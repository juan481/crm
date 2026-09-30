// Cálculo puro (sin Prisma) del precio Gremio sugerido de un KIT — se separa
// de kits.ts para poder importarlo también desde un componente cliente
// (kits-manager.tsx, vista previa en vivo) sin arrastrar el Prisma Client al
// bundle del browser.

/**
 * Calcula el precio Gremio sugerido para un KIT a partir del precio Público
 * ya definido (a mano o por marcación) y los precios de sus componentes,
 * SIN pedirle al usuario que lo cargue aparte. Se aplica la misma
 * marcación/margen que el precio Público tiene sobre el subtotal Público, pero
 * sobre el subtotal Gremio de los componentes — así el KIT respeta la
 * ganancia que Abba definió, en las dos listas.
 *
 * Devuelve null (== "sin dual-pricing", misma convención que Product.precioGremio)
 * cuando ningún componente tiene precio Gremio propio cargado.
 */
export function computeSuggestedGremioPrice(
  resolved: { price: number | null; precioGremio: number | null; quantity: number }[],
  precioPublico: number,
): number | null {
  const matched = resolved.filter((r) => r.price != null)
  const algunoConGremio = matched.some((r) => r.precioGremio != null)
  if (!algunoConGremio) return null

  const subtotalPublico = matched.reduce((s, r) => s + (r.price ?? 0) * r.quantity, 0)
  const subtotalGremio = matched.reduce((s, r) => s + (r.precioGremio ?? r.price ?? 0) * r.quantity, 0)
  if (subtotalPublico <= 0) return Math.round(subtotalGremio * 100) / 100

  const ratio = precioPublico / subtotalPublico
  return Math.round(subtotalGremio * ratio * 100) / 100
}
