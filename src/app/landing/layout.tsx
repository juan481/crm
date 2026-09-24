import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'JustCRM | Sistema Operativo para Empresas de Seguridad y Servicios Técnicos',
  description:
    'El CRM y software de gestión operativo para empresas de seguridad electrónica, telecomunicaciones e instaladores técnicos. Cotizá en 30s, controlá stock, pañol, cuadrillas y WhatsApp con IA.',
  keywords: [
    'JustCRM',
    'CRM seguridad electrónica',
    'software para instaladores técnicos',
    'CRM telecomunicaciones',
    'cotizador en 30 segundos',
    'sistema de stock para pañol',
    'ordenes de trabajo cuadrillas',
    'remitos de entrega instalaciones',
    'bot de whatsapp para ventas e instaladores',
    'CRM Argentina',
    'gestión de abonados monitoreo',
    'software de seguridad y CCTV',
  ],
  alternates: {
    canonical: 'https://crm.justcreate.com.ar/landing',
  },
  openGraph: {
    title: 'JustCRM | Sistema Operativo para Empresas de Seguridad y Servicios Técnicos',
    description:
      'Cotizador Flash en 30 segundos con listas gremio/público, app móvil Mi Día para cuadrillas, pañol con remitos y atención WhatsApp oficial con IA.',
    url: 'https://crm.justcreate.com.ar/landing',
    siteName: 'JustCRM',
    locale: 'es_AR',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JustCRM',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JustCRM | Sistema Operativo para Empresas de Seguridad y Servicios Técnicos',
    description: 'Cotizá en 30s, controlá pañol, cuadrillas y WhatsApp oficial con IA.',
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
        name: 'JustCRM by JustCreate',
        url: 'https://crm.justcreate.com.ar',
        logo: {
          '@type': 'ImageObject',
          url: 'https://crm.justcreate.com.ar/logo.png',
        },
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+5491124527669',
          contactType: 'sales and technical support',
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
        description:
          'Sistema operativo de productividad y CRM diseñado para empresas de seguridad electrónica, telecomunicaciones e instaladores técnicos.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Prueba gratuita de 14 días sin tarjeta de crédito',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '128',
          bestRating: '5',
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
