'use client'

import { Select } from '@/components/ui/select'
import type { ProductCategory, ProductBrand } from '@/types'

interface CatalogFiltersProps {
  categories: ProductCategory[]
  brands: ProductBrand[]
  categoryId: string | null
  onCategoryChange: (id: string | null) => void
  brand: string | null
  onBrandChange: (brand: string | null) => void
  className?: string
}

/**
 * Filtro de Categoría → Subcategoría (en cascada) + Marca, en desplegables.
 * Reemplaza la fila de chips que se usaba antes en /catalogo, el Cotizador
 * y el portal Gremio — con 14-17 categorías raíz y 77 marcas, una fila de
 * chips se vuelve un scroll lateral interminable; un <select> escala sin
 * problema a cualquier cantidad de opciones.
 *
 * Queda controlado por un solo `categoryId` (igual que antes) — el
 * componente no guarda su propio estado de "raíz seleccionada", lo deriva
 * de `categoryId` buscando a qué raíz pertenece (raíz directa, o padre de
 * la subcategoría elegida). Así ningún consumidor externo necesita saber
 * que por dentro hay dos niveles.
 */
export function CatalogFilters({
  categories,
  brands,
  categoryId,
  onCategoryChange,
  brand,
  onBrandChange,
  className,
}: CatalogFiltersProps) {
  const selectedRoot =
    categories.find((c) => c.id === categoryId) ??
    categories.find((c) => c.children?.some((ch) => ch.id === categoryId)) ??
    null

  const rootOptions = [
    { value: '', label: 'Todas las categorías' },
    ...categories.map((c) => ({ value: c.id, label: `${c.name} (${c.productCount})` })),
  ]

  const childOptions = selectedRoot?.children?.length
    ? [
        { value: '', label: `Todas las de ${selectedRoot.name}` },
        ...selectedRoot.children.map((ch) => ({ value: ch.id, label: `${ch.name} (${ch.productCount})` })),
      ]
    : []

  const brandOptions = [
    { value: '', label: 'Todas las marcas' },
    ...brands.map((b) => ({ value: b.value, label: `${b.value} (${b.count})` })),
  ]

  const selectedChildValue = selectedRoot && categoryId !== selectedRoot.id ? categoryId ?? '' : ''

  return (
    <div className={className ?? 'grid grid-cols-1 sm:grid-cols-3 gap-3'}>
      {/* Marca primero, categoría/subcategoría después — orden pedido
          explícitamente por Juan tras ver el filtro en uso real. */}
      <Select
        options={brandOptions}
        value={brand ?? ''}
        onChange={(e) => onBrandChange(e.target.value || null)}
      />
      <Select
        options={rootOptions}
        value={selectedRoot?.id ?? ''}
        onChange={(e) => onCategoryChange(e.target.value || null)}
      />
      {childOptions.length > 0 && (
        <Select
          options={childOptions}
          value={selectedChildValue}
          onChange={(e) => onCategoryChange(e.target.value || selectedRoot!.id)}
        />
      )}
    </div>
  )
}
