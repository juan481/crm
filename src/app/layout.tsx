import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CRM Pro',
  description: 'CRM White-Label para agencias digitales y empresas.',
  robots: 'noindex, nofollow',
  manifest: '/manifest.json',
  icons: {
    // iOS no lee manifest.json para el ícono de "agregar a inicio" — necesita
    // este link explícito además del manifest (que sí cubre Android/desktop).
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6366f1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${poppins.variable} dark`} suppressHydrationWarning>
      <body className="font-poppins">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
