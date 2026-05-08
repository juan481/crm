'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  primaryColor: string
  secondaryColor: string
  crmName: string
  logoUrl: string | null
  darkMode: boolean

  setPrimaryColor: (color: string) => void
  setSecondaryColor: (color: string) => void
  setCrmName: (name: string) => void
  setLogoUrl: (url: string | null) => void
  toggleDarkMode: () => void
  applyTheme: (primary: string, secondary: string) => void
  loadBranding: (branding: {
    primaryColor: string
    secondaryColor: string
    crmName: string
    logoUrl: string | null
  }) => void
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

function darken(hex: string, amount = 20): string {
  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)
  r = Math.max(0, r - amount)
  g = Math.max(0, g - amount)
  b = Math.max(0, b - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function lighten(hex: string, amount = 40): string {
  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)
  r = Math.min(255, r + amount)
  g = Math.min(255, g + amount)
  b = Math.min(255, b + amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function applyThemeToDom(primary: string, secondary: string): void {
  const root = document.documentElement
  root.style.setProperty('--color-primary', primary)
  root.style.setProperty('--color-primary-hover', darken(primary, 20))
  root.style.setProperty('--color-primary-light', primary + '33') // 20% opacity
  root.style.setProperty('--color-secondary', secondary)
  root.style.setProperty('--color-secondary-hover', darken(secondary, 20))
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      primaryColor: '#6366f1',
      secondaryColor: '#8b5cf6',
      crmName: 'CRM Pro',
      logoUrl: null,
      darkMode: true,

      setPrimaryColor: (color) => {
        set({ primaryColor: color })
        applyThemeToDom(color, get().secondaryColor)
      },

      setSecondaryColor: (color) => {
        set({ secondaryColor: color })
        applyThemeToDom(get().primaryColor, color)
      },

      setCrmName: (name) => set({ crmName: name }),
      setLogoUrl: (url) => set({ logoUrl: url }),

      toggleDarkMode: () => {
        const next = !get().darkMode
        set({ darkMode: next })
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', next)
        }
      },

      applyTheme: (primary, secondary) => {
        set({ primaryColor: primary, secondaryColor: secondary })
        if (typeof document !== 'undefined') {
          applyThemeToDom(primary, secondary)
        }
      },

      loadBranding: (branding) => {
        set(branding)
        if (typeof document !== 'undefined') {
          applyThemeToDom(branding.primaryColor, branding.secondaryColor)
        }
      },
    }),
    {
      name: 'crm-theme',
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== 'undefined') {
          applyThemeToDom(state.primaryColor, state.secondaryColor)
          document.documentElement.classList.toggle('dark', state.darkMode)
        }
      },
    }
  )
)
