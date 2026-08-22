'use client'

import { cn } from '@/lib/utils'

interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (row: T) => React.ReactNode
  // Progressive disclosure para la vista de tarjetas de mobile (ver más
  // abajo) — columnas secundarias que no hacen falta ver siempre en un
  // celular (ej. una descripción larga) pueden marcarse acá para no
  // amontonar la tarjeta. Sin usar en ningún lado todavía: todas las
  // columnas existentes siguen mostrándose igual que antes por default.
  hideOnMobileCard?: boolean
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
  className?: string
}

function renderCell<T>(col: Column<T>, row: T): React.ReactNode {
  return col.render ? col.render(row) : String(row[col.key as keyof T] ?? '')
}

export function Table<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  loading,
  emptyMessage = 'No hay datos para mostrar',
  className,
}: TableProps<T>) {
  // Antes esto era SIEMPRE un <table> con overflow-x-auto — en un celular
  // angosto, cualquier tabla de más de 3-4 columnas (ej. Facturas: Cliente/
  // Descripción/Monto/Vencimiento/Estado/Acciones) quedaba con la última
  // columna cortada por el borde de la pantalla y sólo un scrollbar mudo
  // como pista de que había más para el costado — el patrón que hoy se
  // recomienda para esto (Stripe, Linear, Airtable en mobile) es mostrar
  // cada fila como una tarjeta apilada verticalmente en vez de pedirle al
  // usuario que scrollee de costado. La tabla de escritorio no cambia en
  // nada; se agrega una vista de tarjetas aparte, sólo visible por debajo
  // de md, y se esconde una a la otra por CSS (no hay dos fetches ni dos
  // estados — es la misma `data`).
  const [titleCol, ...restCols] = columns
  const visibleRestCols = restCols.filter((c) => !c.hideOnMobileCard)

  return (
    <div className={className}>
      {/* ── Vista de escritorio: tabla clásica, sin cambios ──
          lg, no md: el resto de la app (sidebar, drawer mobile, Barra
          Rápida) corta mobile/desktop en lg — con md acá, una tablet entre
          768-1024px se quedaba con la barra de mobile Y la tabla de
          escritorio a la vez, dos criterios de "qué es mobile" distintos
          en la misma pantalla. */}
      <div className={cn('hidden lg:block overflow-x-auto rounded-2xl surface')}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className={cn(
                    'px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    !col.align && 'text-left'
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-5 py-4">
                      <div className="h-4 bg-[var(--color-surface-raised)] rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-16 text-center text-sm text-[var(--color-text-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors duration-150',
                    onRowClick && 'cursor-pointer hover:bg-[var(--color-surface-raised)]'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn(
                        'px-5 py-3.5 text-sm text-[var(--color-text)]',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right'
                      )}
                    >
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Vista de tarjetas: sólo mobile (debajo de lg, ver comentario arriba) ── */}
      <div className="lg:hidden rounded-2xl surface overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[var(--color-border)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2.5 animate-pulse">
                <div className="h-4 bg-[var(--color-surface-raised)] rounded w-2/3" />
                <div className="h-3 bg-[var(--color-surface-raised)] rounded w-1/2" />
                <div className="h-3 bg-[var(--color-surface-raised)] rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-[var(--color-text-muted)]">{emptyMessage}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {data.map((row) => (
              <li
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('p-4', onRowClick && 'cursor-pointer active:bg-[var(--color-surface-raised)]')}
              >
                {/* Primera columna = título de la tarjeta (en las 6 pantallas
                    que usan este componente hoy, esa columna ya es lo que
                    identifica a la fila: empresa, cliente, ref de cotización). */}
                <div className="font-semibold text-sm text-[var(--color-text)] mb-2.5 truncate">
                  {renderCell(titleCol, row)}
                </div>
                <div className="space-y-1.5">
                  {visibleRestCols.map((col) => (
                    <div key={String(col.key)} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-subtle)] shrink-0 pt-0.5">
                        {col.header}
                      </span>
                      <span className="text-[var(--color-text)] text-right min-w-0">{renderCell(col, row)}</span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// Pagination component
interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between px-1 mt-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        Mostrando <span className="font-medium text-[var(--color-text)]">{start}–{end}</span> de{' '}
        <span className="font-medium text-[var(--color-text)]">{total}</span> resultados
      </p>
      <div className="flex gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'w-8 h-8 rounded-lg text-sm font-medium transition-all duration-150',
              p === page
                ? 'gradient-bg text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]'
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
