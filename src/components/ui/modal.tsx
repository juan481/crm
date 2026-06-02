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
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
          'relative w-full z-10 rounded-2xl flex flex-col',
          sizeClasses[size],
          'max-h-[90vh]',
        )}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        {(title || showClose) && (
          <div
            className="flex items-center justify-between gap-3 px-5 py-4 shrink-0 rounded-t-2xl"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="text-base font-semibold truncate" style={{ color: 'var(--color-text)' }}>
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
                className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-raised)]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={17} />
              </button>
            )}
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0 p-5">
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
