import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://crm.justcreate.com.ar'),
  title: {
    default: 'JustCRM | Sistema Operativo de Gestión, Obras y Servicios Técnicos',
    template: '%s | JustCRM',
  },
  description:
    'El CRM y Productivity OS diseñado para empresas de seguridad electrónica, telecomunicaciones e instaladores técnicos. Cotizá en 30s, controlá stock, pañol, cuadrillas y WhatsApp con IA.',
  applicationName: 'JustCRM',
  authors: [{ name: 'JustCreate', url: 'https://justcreate.com.ar' }],
  creator: 'JustCreate',
  publisher: 'JustCreate',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: 'https://crm.justcreate.com.ar',
    title: 'JustCRM | Sistema Operativo para Empresas de Seguridad y Servicios Técnicos',
    description:
      'Cotizador en 30s con listas gremio/público, app móvil para cuadrillas, pañol con remitos y atención WhatsApp con IA.',
    siteName: 'JustCRM',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JustCRM Productivity OS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JustCRM | Sistema Operativo para Empresas Técnicas',
    description: 'Cotizá en 30 segundos, gestioná cuadrillas en calle y automatizá WhatsApp con IA.',
    images: ['/og-image.png'],
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
