// Service worker mínimo — sólo existe para que el navegador considere la
// app "instalable" (PWA). A propósito NO cachea absolutamente nada bajo
// /api/* (network-only passthrough): este CRM es multi-tenant con un
// switcher de organización (ver OrgSwitcher en sidebar.tsx) — cachear una
// respuesta de API acá adentro podría, en teoría, servir datos viejos de
// una organización después de cambiar a otra. No vale el riesgo por una
// ganancia de performance que ya se ataca en otro lado. Sólo precachea
// assets estáticos versionados por build-id (/_next/static/*) y los pocos
// archivos públicos que no cambian de contenido por sesión.
const CACHE_NAME = 'crm-shell-v1'
const PRECACHE_URLS = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Nunca tocar /api/* — passthrough directo a la red, sin caché.
  if (url.pathname.startsWith('/api/')) return

  // Sólo cachear (con estrategia cache-first) assets estáticos versionados
  // por Next (_next/static) y los archivos públicos precacheados arriba.
  const isStaticAsset = url.pathname.startsWith('/_next/static/') || PRECACHE_URLS.includes(url.pathname)
  if (!isStaticAsset) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((res) => {
        const resClone = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone)).catch(() => {})
        return res
      })
    })
  )
})
