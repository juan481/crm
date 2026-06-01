import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md'
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger:  'bg-red-50 text-red-700 border-red-200',
  info:    'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  primary: 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border-[var(--color-primary)]/20',
}

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-slate-400',
  primary: 'bg-[var(--color-primary)]',
}

export function Badge({ variant = 'neutral', children, className, size = 'sm', dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border font-semibold rounded-full',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variantClasses[variant],
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  )
}
