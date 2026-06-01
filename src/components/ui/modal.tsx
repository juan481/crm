'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showClose?: boolean
}

const sizeClasses = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showClose = true,
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          // Mobile: slides up from bottom, full-width, rounded top only
          'relative w-full rounded-t-2xl sm:rounded-2xl z-10',
          // Desktop: centered, max-width by size, full rounded
          sizeClasses[size],
          // Height: never exceed 90vh, scroll inside
          'max-h-[90vh] flex flex-col',
        )}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12), 0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header — fixed, never scrolls */}
        {(title || showClose) && (
          <div
            className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  className="text-base font-semibold truncate"
                  style={{ color: 'var(--color-text)' }}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-lg transition-all"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <X size={17} />
              </button>
            )}
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('flex justify-end gap-3 pt-4 mt-2', className)}
      style={{ borderTop: '1px solid var(--color-border)' }}
    >
      {children}
    </div>
  )
}
