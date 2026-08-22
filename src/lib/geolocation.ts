// Ubicación opcional al fichar — usada por attendance-widget.tsx y
// mi-dia/page.tsx antes de POSTear a check-in/check-out. Regla no
// negociable: el GPS NUNCA puede bloquear ni demorar visiblemente el
// fichaje (mismo espíritu "SIN FALLAS" del resto del sistema de fichaje) —
// por eso esto siempre resuelve, nunca rechaza: sin soporte del navegador,
// sin permiso, o si tarda más que el timeout, devuelve null y quien llama
// ficha igual sin lat/lng.
export function getPositionSafe(timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(null); return }
    const timer = setTimeout(() => resolve(null), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }) },
      () => { clearTimeout(timer); resolve(null) },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}
