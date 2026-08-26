'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes, ShoppingCart, Receipt } from 'lucide-react'
import { useGremioCartStore } from '@/store/gremio-cart-store'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/gremio/catalogo', label: 'Catálogo', icon: Boxes },
  { href: '/gremio/carrito', label: 'Carrito', icon: ShoppingCart },
  { href: '/gremio/pedidos', label: 'Mis Pedidos', icon: Receipt },
] as const

// Bottom nav de 3 ítems fijos — no reusa MobileQuickBar (pensado para el
// ranking de "más usadas" entre 16 pantallas de staff); acá alcanza con
// links fijos, mismo criterio visual (iconos Lucide, tokens var(--color-*)).
export function GremioBottomNav() {
  const pathname = usePathname()
  const cartCount = useGremioCartStore((s) => Object.values(s.items).reduce((n, i) => n + i.quantity, 0))

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 flex items-stretch"
      style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 relative transition-colors',
              active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'
            )}
          >
            <div className="relative">
              <Icon size={20} />
              {href === '/gremio/carrito' && cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
