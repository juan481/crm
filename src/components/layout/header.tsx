'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, Menu, X, Moon, Sun, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useThemeStore } from '@/store/theme-store'
import { useAuthStore } from '@/store/auth-store'
import { cn, CLIENT_STATUS_LABELS } from '@/lib/utils'
import type { Client } from '@/types'
import type { AppNotification } from '@/app/api/notifications/route'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { darkMode, toggleDarkMode } = useThemeStore()
  const { user } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const { data: searchResults } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return []
      const res = await fetch(`/api/clients?search=${encodeURIComponent(searchQuery)}&limit=6`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.data ?? []) as Client[]
    },
    enabled: searchQuery.length >= 2,
    staleTime: 30 * 1000,
  })

  const { data: notifData } = useQuery<{ data: AppNotification[] }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  const notifications = notifData?.data ?? []
  const unreadCount = notifications.length

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleClientSelect = (id: string) => {
    setSearchQuery('')
    setSearchOpen(false)
    router.push(`/clients/${id}`)
  }

  const greetingHour = new Date().getHours()
  const greeting =
    greetingHour < 12 ? 'Buenos días' : greetingHour < 18 ? 'Buenas tardes' : 'Buenas noches'

  const severityIcon = (s: string) => {
    if (s === 'danger') return <AlertCircle size={14} className="text-red-400 shrink-0" />
    if (s === 'warning') return <AlertTriangle size={14} className="text-amber-400 shrink-0" />
    return <Info size={14} className="text-blue-400 shrink-0" />
  }

  return (
    <header className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center gap-4 px-4 lg:px-6 shrink-0">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Greeting */}
      <div className="hidden md:block">
        <p className="text-sm font-medium text-[var(--color-text)]">
          {greeting}, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
        </p>
      </div>

      {/* Global Search */}
      <div ref={searchRef} className="flex-1 max-w-md ml-auto lg:ml-0 relative">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200',
            searchOpen
              ? 'border-[var(--color-primary)] bg-[var(--color-surface-raised)] ring-2 ring-[var(--color-primary-light)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-[var(--color-border-strong)]'
          )}
        >
          <Search size={16} className="text-[var(--color-text-subtle)] shrink-0" />
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] outline-none font-poppins min-w-0"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
              className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <AnimatePresence>
          {searchOpen && searchQuery.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full mt-2 w-full bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] rounded-2xl shadow-modal overflow-hidden z-50"
            >
              {!searchResults || searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[var(--color-text-muted)] text-center">
                  Sin resultados para &quot;{searchQuery}&quot;
                </p>
              ) : (
                <ul>
                  {searchResults.map((client) => (
                    <li key={client.id}>
                      <button
                        onClick={() => handleClientSelect(client.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-overlay)] transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {client.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text)] truncate">{client.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)] truncate">{client.email}</p>
                        </div>
                        <span className="ml-auto text-xs text-[var(--color-text-subtle)] shrink-0">
                          {CLIENT_STATUS_LABELS[client.status]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)] transition-all"
          title="Cambiar tema"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)] transition-all relative"
            title="Notificaciones"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)] rounded-2xl shadow-modal overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Notificaciones</p>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium">
                      {unreadCount} alerta{unreadCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={24} className="mx-auto mb-2 text-[var(--color-text-subtle)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">Sin alertas pendientes</p>
                    <p className="text-xs text-[var(--color-text-subtle)] mt-1">Todo está al día</p>
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)]">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <Link
                          href={n.href}
                          onClick={() => setNotifOpen(false)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-overlay)] transition-colors"
                        >
                          {severityIcon(n.severity)}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--color-text)]">{n.title}</p>
                            <p className="text-xs text-[var(--color-text-muted)] truncate">{n.body}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="border-t border-[var(--color-border)] px-4 py-2.5">
                  <Link
                    href="/invoices"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    Ver facturación →
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
