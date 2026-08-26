'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Carrito del portal Gremio — cliente puro, sin llamar a la API hasta
// confirmar el pedido (POST /api/gremio/pedidos). Persistido en
// localStorage (mismo patrón que theme-store.ts) para que no se pierda si
// el usuario cierra el navegador a mitad de armar el pedido — es local por
// dispositivo, no compartido entre sesiones.
export interface GremioCartItem {
  productId: string
  sku: string | null
  name: string
  precioGremio: number
  precioPublico: number
  currency: string
  quantity: number
}

interface GremioCartState {
  items: Record<string, GremioCartItem>
  addItem: (item: Omit<GremioCartItem, 'quantity'>, qty?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, qty: number) => void
  clear: () => void
}

export const useGremioCartStore = create<GremioCartState>()(
  persist(
    (set) => ({
      items: {},
      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items[item.productId]
          return {
            items: {
              ...state.items,
              [item.productId]: { ...item, quantity: (existing?.quantity ?? 0) + qty },
            },
          }
        }),
      removeItem: (productId) =>
        set((state) => {
          const next = { ...state.items }
          delete next[productId]
          return { items: next }
        }),
      setQuantity: (productId, qty) =>
        set((state) => {
          if (!state.items[productId]) return state
          const n = Math.max(1, Math.floor(qty) || 1)
          return { items: { ...state.items, [productId]: { ...state.items[productId], quantity: n } } }
        }),
      clear: () => set({ items: {} }),
    }),
    { name: 'gremio-cart' }
  )
)
