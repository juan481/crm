import { Avatar } from './avatar'

interface Person { id: string; name: string; avatarUrl?: string | null }

const SIZE_PX: Record<'xs' | 'sm' | 'md', number> = { xs: 24, sm: 32, md: 40 }

// Estilo Jira: círculos superpuestos con un borde del color del fondo para
// separarlos visualmente, y un "+N" si hay más gente de la que entra. Usado
// donde antes se mostraba un solo Avatar (o texto "Asignado: Nombre") — con
// colaboradores, puede haber más de una persona en la misma tarea/ticket.
export function AvatarStack({ people, max = 3, size = 'sm' }: { people: Person[]; max?: number; size?: 'xs' | 'sm' | 'md' }) {
  if (!people.length) return null
  const px = SIZE_PX[size]
  const overlap = Math.round(px * 0.35)
  const visible = people.slice(0, max)
  const overflow = people.length - visible.length

  return (
    <div className="flex items-center">
      {visible.map((p, i) => (
        <div key={p.id} title={p.name} className="rounded-full shrink-0"
          style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: visible.length - i, border: '2px solid var(--color-surface)' }}>
          <Avatar name={p.name} src={p.avatarUrl} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          title={people.slice(max).map(p => p.name).join(', ')}
          className="rounded-full shrink-0 flex items-center justify-center font-semibold"
          style={{
            marginLeft: -overlap, zIndex: 0, border: '2px solid var(--color-surface)',
            width: px, height: px, background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)',
            fontSize: px * 0.4,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
