'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { exportClientsToXLSX, exportClientsToCSV } from '@/lib/export'
import type { Client } from '@/types'
import toast from 'react-hot-toast'

interface ExportMenuProps {
  clients: Client[]
}

export function ExportMenu({ clients }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleExport = (format: 'xlsx' | 'csv') => {
    if (clients.length === 0) {
      toast.error('No hay clientes para exportar')
      return
    }
    setOpen(false)
    if (format === 'xlsx') exportClientsToXLSX(clients)
    else exportClientsToCSV(clients)
    toast.success(`Exportando ${clients.length} clientes en ${format.toUpperCase()}`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] transition-all"
      >
        <Download size={15} />
        Exportar
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-48 bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] rounded-2xl shadow-modal overflow-hidden z-50"
          >
            <button
              onClick={() => handleExport('xlsx')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-overlay)] transition-colors text-left text-sm text-[var(--color-text)]"
            >
              <FileSpreadsheet size={16} className="text-emerald-400" />
              Exportar a Excel
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-overlay)] transition-colors text-left text-sm text-[var(--color-text)]"
            >
              <FileText size={16} className="text-blue-400" />
              Exportar a CSV
            </button>
            <div className="px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-subtle)]">
              {clients.length} registros seleccionados
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
