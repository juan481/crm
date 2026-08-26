'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react'
import { Button } from './button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  code: string | null
  copied: boolean
}

// Código corto y legible en voz alta — 8 caracteres en base36 mayúscula
// (dígitos + letras, sin distinguir 0/O ni 1/I porque nunca se generan acá
// tal cual, pero igual se lee bien por WhatsApp/teléfono). No hace falta
// que sea criptográficamente único, sólo lo bastante para no chocar en la
// práctica — se guarda en ErrorLog con @unique, un choque literal
// simplemente haría fallar ESE insert puntual sin romper nada más grave.
function generateErrorCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, code: null, copied: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
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
    // roto). Se soluciona forzando un reload REAL de la página, una sola
    // vez (el guard en sessionStorage evita un loop infinito si el error
    // persiste por otra razón real — ahí sí se muestra la pantalla de
    // error de abajo, con código). AppShell limpia este guard en cada
    // carga completa nueva, así vuelve a poder auto-recuperarse en el
    // próximo deploy.
    const isChunkError = error.name === 'ChunkLoadError'
      || /loading chunk|failed to fetch dynamically imported module|importing a module script failed/i.test(error.message)
    if (isChunkError && typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      const guardKey = 'crm-chunk-reload-attempted'
      if (!sessionStorage.getItem(guardKey)) {
        sessionStorage.setItem(guardKey, '1')
        window.location.reload()
        return // no hace falta generar código: si esto anda, nunca se ve esta pantalla
      }
    }

    // Error real (o ChunkLoadError que persistió incluso después del
    // reload) — se genera un código y se manda a guardar. Fire-and-forget:
    // si /api/errors falla (ej. sin red), igual se muestra el código en
    // pantalla — mejor eso que bloquear el fallback por un error al
        // reportar el error.
    const code = generateErrorCode()
    this.setState({ code })
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {})
    } catch { /* noop */ }
  }

  handleCopy = () => {
    if (!this.state.code) return
    navigator.clipboard?.writeText(this.state.code).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    }).catch(() => {})
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
              Ocurrió un error inesperado. Podés intentar recargar la sección o avisar a soporte con el código de abajo.
            </p>
            {this.state.code && (
              <button
                onClick={this.handleCopy}
                title="Copiar código"
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-muted)' }}
              >
                Código: <span className="font-bold" style={{ color: 'var(--color-text)' }}>{this.state.code}</span>
                {this.state.copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            )}
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
            onClick={() => this.setState({ hasError: false, error: null, code: null, copied: false })}
          >
            Reintentar
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
