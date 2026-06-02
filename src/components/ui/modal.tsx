'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
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

// Framer Motion variants — all within 100-150ms
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
  exit:    { opacity: 0, transition: { duration: 0.08 } },
}

const panelVariants = {
  hidden:  { opacity: 0, scale: 0.97, y: -6 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.13, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.08 } },
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
  const portalRef = useRef<HTMLElement | null>(null)

  // Keyboard + scroll lock
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

  // Ensure portal target exists (SSR-safe)
  if (typeof document === 'undefined') return null
  if (!portalRef.current) portalRef.current = document.body

  return createPortal(
    <AnimatePresence>
      {open && (
        // Full-screen overlay — rendered directly in <body>, no stacking context issues
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative w-full z-10 rounded-2xl flex flex-col',
              sizeClasses[size],
              'max-h-[90vh]',
            )}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-strong)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
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
                    className="shrink-0 p-1.5 rounded-lg transition-colors duration-100 hover:bg-[var(--color-surface-raised)]"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
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
