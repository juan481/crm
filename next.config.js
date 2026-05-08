/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async redirects() {
    return [
      { source: '/clients', destination: '/clientes', permanent: true },
      { source: '/clients/:id', destination: '/clientes/:id', permanent: true },
      { source: '/invoices', destination: '/facturas', permanent: true },
      { source: '/communications', destination: '/comunicaciones', permanent: true },
      { source: '/settings', destination: '/configuracion', permanent: true },
      { source: '/settings/branding', destination: '/configuracion/marca', permanent: true },
      { source: '/settings/users', destination: '/configuracion/usuarios', permanent: true },
      { source: '/settings/email', destination: '/configuracion/correo', permanent: true },
      { source: '/settings/services', destination: '/configuracion/servicios', permanent: true },
      { source: '/settings/plugins', destination: '/configuracion/plugins', permanent: true },
    ]
  },
}

module.exports = nextConfig
