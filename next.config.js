/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.io' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/clients',            destination: '/clientes',             permanent: false },
      { source: '/clients/:id',        destination: '/clientes/:id',         permanent: false },
      { source: '/invoices',           destination: '/facturas',             permanent: false },
      { source: '/communications',     destination: '/comunicaciones',       permanent: false },
      { source: '/settings',           destination: '/configuracion',        permanent: false },
      { source: '/settings/branding',  destination: '/configuracion/marca',  permanent: false },
      { source: '/settings/users',     destination: '/configuracion/usuarios', permanent: false },
      { source: '/settings/email',     destination: '/configuracion/correo', permanent: false },
      { source: '/settings/services',  destination: '/configuracion/servicios', permanent: false },
      { source: '/settings/plugins',   destination: '/configuracion/plugins', permanent: false },
    ]
  },
}

module.exports = nextConfig
