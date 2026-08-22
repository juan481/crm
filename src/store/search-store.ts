'use client'

import { create } from 'zustand'

// Estado ínfimo (un booleano) que antes vivía sólo adentro de AppHeader —
// se saca a un store aparte para que la Barra Rápida (mobile-quick-bar.tsx)
// pueda abrir el MISMO buscador del header con su botón "Buscar" en vez de
// duplicar la lógica de búsqueda de empresas en un segundo lugar. Sin
// persist a propósito: es un estado de UI efímero, no algo que tenga
// sentido recordar entre sesiones.
interface SearchState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useSearchStore = create<SearchState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
