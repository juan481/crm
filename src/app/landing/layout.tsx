import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'JustCRM | Ventas, IA y operación en un solo sistema' },
  description:
    'Conectá WhatsApp con IA, pipeline, cotizaciones, campañas masivas, equipos técnicos, stock, facturación y cobranzas en una sola plataforma adaptable a tu empresa.',
  keywords: [
    'JustCRM',
    'CRM con IA',
    'CRM WhatsApp Argentina',
    'pipeline comercial',
    'campañas masivas',
    'cotizaciones y stock',
    'gestión de equipos técnicos',
    'facturación y cobranzas',
    'software de gestión empresarial',
  ],
  alternates: { canonical: 'https://crm.justcreate.com.ar/landing' },
  openGraph: {
    title: 'JustCRM | De una conversación a una venta',
    description: 'Ventas, IA, operación y administración conectadas en un solo sistema.',
    url: 'https://crm.justcreate.com.ar/landing',
    siteName: 'JustCRM',
    locale: 'es_AR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'JustCRM' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JustCRM | Ventas, IA y operación en un solo sistema',
    description: 'Conectá WhatsApp, pipeline, cotizaciones y operación con una implementación adaptada a tu empresa.',
    images: ['/og-image.png'],
  },
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://crm.justcreate.com.ar/#organization',
        name: 'JustCRM by Just Create',
        url: 'https://crm.justcreate.com.ar',
        logo: 'https://crm.justcreate.com.ar/logo.png',
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+5491124527669',
          contactType: 'sales',
          email: 'contacto@justcreate.com.ar',
          areaServed: 'AR',
          availableLanguage: ['Spanish'],
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': 'https://crm.justcreate.com.ar/#software',
        name: 'JustCRM',
        operatingSystem: 'Web, Android, iOS (PWA)',
        applicationCategory: 'BusinessApplication',
        description: 'CRM operativo que conecta ventas, atención con IA, cotizaciones, operación, inventario y administración.',
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
