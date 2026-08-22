'use client'

// Mapa embebido de fichajes (panel de Sergio, /rrhh/turnos) — reemplaza
// tener que abrir un link de Google Maps por fila para ver dónde fichó
// cada uno; acá se ven todos los puntos del filtro actual juntos, de un
// vistazo. OpenStreetMap + Leaflet: sin costo, sin API key (a diferencia
// de Google Maps, que si se usara para esto — muchos marcadores, mapa
// interactivo — sí puede facturar por carga de mapa).
//
// Este componente sólo se monta client-side (ver import dynámico con
// ssr:false en rrhh/turnos/page.tsx) — Leaflet toca `window`/`document`
// directamente y no soporta server-side rendering.

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export interface MapPoint {
  lat: number
  lng: number
  label: string
  kind: 'entrada' | 'salida'
}

interface Props {
  points: MapPoint[]
}

const COLOR: Record<MapPoint['kind'], string> = {
  entrada: '#10b981', // verde — mismo color que "en curso" en el resto del fichaje
  salida:  '#6366f1', // indigo — color primario de la marca
}

export function TecnicosMap({ points }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // any: tipar la instancia real de L.Map obligaría a importar leaflet
  // también a nivel de tipos en el módulo raíz, que es justo lo que se
  // evita importando la librería sólo dinámicamente adentro del efecto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    import('leaflet').then((mod) => {
      if (cancelled || !containerRef.current) return
      const L = mod.default

      const map = L.map(containerRef.current, { scrollWheelZoom: false })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const bounds: [number, number][] = []
      for (const p of points) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${COLOR[p.kind]};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
        L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(p.label)
        bounds.push([p.lat, p.lng])
      }

      if (bounds.length === 1) map.setView(bounds[0], 15)
      else map.fitBounds(bounds, { padding: [28, 28] })
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  return <div ref={containerRef} className="w-full h-full" style={{ minHeight: 280 }} />
}
