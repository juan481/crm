'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Bell, Search, Menu, X, Sun, Moon, AlertCircle, AlertTriangle, Info, LogOut } from 'lucide-react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/auth-store'
import { useThemeStore } from '@/store/theme-store'
import type { Client } from '@/types'
import type { AppNotification } from '@/app/api/notifications/route'

interface AppHeaderProps {
  user: { name: string; email: string; avatarUrl: string | null; role: string }
  onMenuToggle: () => void
}

export function AppHeader({ user, onMenuToggle }: AppHeaderProps) {
  const router = useRouter()
  const { logout } = useAuthStore()
  const { darkMode, toggleDarkMode } = useThemeStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setSearchQuery('')
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  const notifications = notifData?.data ?? []
  const unreadCount = notifications.length

  const severityIcon = (s: string) => {
    if (s === 'danger') return <AlertCircle size={14} className="text-red-500 shrink-0" />
    if (s === 'warning') return <AlertTriangle size={14} className="text-amber-500 shrink-0" />
    return <Info size={14} className="text-blue-500 shrink-0" />
  }

  return (
    <header
      className="h-14 flex items-center gap-3 px-4 lg:px-6 shrink-0"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] transition-all"
      >
        <Menu size={18} />
      </button>

      {/* Search */}
      <div ref={searchRef} className="relative flex-1 max-w-xs">
        {searchOpen ? (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 w-64"
            style={{
              borderColor: 'var(--color-primary)',
              background: 'var(--color-surface-raised)',
              boxShadow: '0 0 0 3px var(--color-primary-light)',
            }}
          >
            <Search size={14} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar clientes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none min-w-0"
              style={{ color: 'var(--color-text)' }}
            />
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }}>
              <X size={13} style={{ color: 'var(--color-text-subtle)' }} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border w-40 text-left hover:border-[var(--color-border-strong)] transition-colors"
            style={{
              color: 'var(--color-text-muted)',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
            }}
          >
            <Search size={14} />
            <span className="text-xs">Buscar...</span>
          </button>
        )}

        {/* Search results */}
        {searchOpen && searchQuery.length >= 2 && (
          <div
            className="absolute left-0 top-full mt-1 w-72 rounded-2xl overflow-hidden z-50"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-strong)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
            }}
          >
            {!searchResults || searchResults.length === 0 ? (
              <p className="px-4 py-3 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                Sin resultados
              </p>
            ) : (
              <ul>
                {searchResults.map((client) => (
                  <li key={client.id}>
                    <button
                      onClick={() => {
                        router.push(`/clientes/${client.id}`)
                        setSearchOpen(false)
                        setSearchQuery('')
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-raised)]"
                    >
                      <div className="w-7 h-7 rounded-lg gradient-bg flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {client.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                          {client.name}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                          {client.email}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl transition-all hover:bg-[var(--color-surface-raised)]"
          style={{ color: 'var(--color-text-muted)' }}
          title="Cambiar tema"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="p-2 rounded-xl transition-all relative hover:bg-[var(--color-surface-raised)]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-80 rounded-2xl overflow-hidden z-50"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  Notificaciones
                </p>
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full font-medium">
                    {unreadCount}
                  </span>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell size={22} className="mx-auto mb-2" style={{ color: 'var(--color-text-subtle)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Sin alertas
                  </p>
                </div>
              ) : (
                <ul className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-surface-raised)]"
                      >
                        {severityIcon(n.severity)}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                            {n.title}
                          </p>
                          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                            {n.body}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* User menu */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-[var(--color-surface-raised)] transition-all"
          >
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <span className="text-xs font-semibold hidden sm:block max-w-[80px] truncate" style={{ color: 'var(--color-text)' }}>
              {user.name.split(' ')[0]}
            </span>
          </button>
          {userOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-52 rounded-2xl overflow-hidden z-50"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                  {user.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {user.email}
                </p>
              </div>
              <button
                onClick={() => { setUserOpen(false); logout() }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
