import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://crm.justcreate.com.ar'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/landing',
          '/landing.html',
          '/login',
          '/logo.png',
          '/og-image.png',
          '/favicon.ico',
          '/apple-touch-icon.png',
          '/icons/*',
        ],
        disallow: [
          '/dashboard',
          '/dashboard/*',
          '/api/*',
          '/portal/*',
          '/admin/*',
          '/rrhh/*',
          '/clientes/*',
          '/cotizador/*',
          '/facturas/*',
          '/tareas/*',
          '/configuracion/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
