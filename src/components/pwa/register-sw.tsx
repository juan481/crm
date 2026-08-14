'use client'

import { useEffect } from 'react'

// Registra el service worker una sola vez por sesión de navegador — no
// renderiza nada. Ver public/sw.js para la política de caché (nunca /api/*).
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silencioso a propósito — no es crítico para el uso normal del CRM,
      // sólo afecta la posibilidad de "instalarlo" como app.
    })
  }, [])

  return null
}
