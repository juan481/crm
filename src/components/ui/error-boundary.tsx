'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)

    // Bug real reportado en producción (2026-08-21): cada vez que se
    // despliega una versión nueva del CRM, alguien que ya tenía una
    // pestaña abierta puede intentar cargar un chunk de JS de la versión
    // VIEJA que ya no existe más (Vercel reemplaza los assets de cada
    // build) — un "ChunkLoadError" clásico de Next.js. Antes esto caía acá
    // mostrando "Algo salió mal", y el botón "Reintentar" no servía de
    // nada (sólo resetea el estado de React, no vuelve a pedir el chunk
    // roto — por eso Sebastián lo vio fallar de nuevo después de tocar
    // Reintentar). Se soluciona forzando un reload REAL de la página, una
    // sola vez (el guard en sessionStorage evita un loop infinito si el
    // error persiste por otra razón real — ahí sí se muestra la pantalla
    // de error normal). AppShell limpia este guard en cada carga completa
    // nueva (ver app-shell.tsx), así vuelve a poder auto-recuperarse en el
    // próximo deploy.
    const isChunkError = error.name === 'ChunkLoadError'
      || /loading chunk|failed to fetch dynamically imported module|importing a module script failed/i.test(error.message)
    if (isChunkError && typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      const guardKey = 'crm-chunk-reload-attempted'
      if (!sessionStorage.getItem(guardKey)) {
        sessionStorage.setItem(guardKey, '1')
        window.location.reload()
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 p-8">
          <div className="p-4 rounded-full bg-red-500/10">
            <AlertTriangle size={32} className="text-red-400" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">
              Algo salió mal
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-sm">
              Ocurrió un error inesperado. Puedes intentar recargar la sección o contactar al soporte.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-3 text-xs text-red-400 bg-red-500/5 rounded-xl p-3 text-left max-w-lg overflow-auto">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reintentar
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
