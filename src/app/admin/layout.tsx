export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPlatformAdmin } from '@/lib/auth'
import { ShieldAlert } from 'lucide-react'
import { AdminLogoutButton } from '@/components/layout/admin-logout-button'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdmin()
  // Not a platform admin: send to /dashboard, not /login — their session is
  // perfectly valid, just not for this. No signOut() here (no loop risk).
  if (!admin) redirect('/dashboard')

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <header
        className="h-14 flex items-center gap-3 px-6"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: '#0f172a' }}>
          <ShieldAlert size={16} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Panel de Administración</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Agencia — JustCreate</p>
        </div>
        <AdminLogoutButton />
      </header>
      <main className="p-4 lg:p-6 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  )
}
