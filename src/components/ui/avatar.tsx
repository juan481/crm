import { cn, getInitials } from '@/lib/utils'
import Image from 'next/image'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = getInitials(name)

  return (
    <div
      className={cn(
        'relative rounded-full shrink-0 overflow-hidden flex items-center justify-center',
        'gradient-bg font-semibold text-white',
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <Image src={src} alt={name} fill className="object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
