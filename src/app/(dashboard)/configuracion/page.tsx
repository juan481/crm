import Link from 'next/link'
import { Shield, UserCog, Puzzle, Settings } from 'lucide-react'

const settingsSections = [
  {
    href: '/configuracion/marca',
    icon: <Shield size={24} />,
    title: 'Marca Blanca',
    description: 'Personaliza el logo, nombre del CRM y la paleta de colores de toda la interfaz.',
    roles: ['SUPER_ADMIN'],
    color: '#6366f1',
  },
  {
    href: '/configuracion/usuarios',
    icon: <UserCog size={24} />,
    title: 'Gestión de Usuarios',
    description: 'Crea, edita, suspende o elimina usuarios. Fuerza cambio de contraseña y asigna roles.',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    color: '#3b82f6',
  },
  {
    href: '/configuracion/plugins',
    icon: <Puzzle size={24} />,
    title: 'Plugins & Extensiones',
    description: 'Activa o desactiva módulos del CRM como campañas de email, integraciones y analytics.',
    roles: ['SUPER_ADMIN'],
    color: '#8b5cf6',
  },
]

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Configuración</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Administra tu cuenta y organización</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="surface rounded-2xl p-6 flex flex-col gap-4 hover:border-[var(--color-border-strong)] hover:-translate-y-0.5 hover:shadow-card transition-all duration-200 group"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
              style={{ background: `${section.color}22`, color: section.color }}
            >
              {section.icon}
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-text)] mb-1 group-hover:gradient-text transition-all">
                {section.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                {section.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
