'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: number
  trendLabel?: string
  accentColor?: string
  index?: number
  href?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  accentColor = 'var(--color-primary)',
  index = 0,
  href,
}: MetricCardProps) {
  const isPositive = (trend ?? 0) >= 0

  const inner = (
    <>
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor})` }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={
              isPositive
                ? { background: '#dcfce7', color: '#16a34a' }
                : { background: '#fee2e2', color: '#dc2626' }
            }
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div className="flex-1">
        <p className="text-2xl font-bold mb-0.5" style={{ color: 'var(--color-text)' }}>
          {value}
        </p>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </p>
        {(subtitle || trendLabel) && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
            {trendLabel ?? subtitle}
          </p>
        )}
      </div>

      {href && (
        <p
          className="flex items-center gap-1 mt-3 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--color-primary)' }}
        >
          Ver detalle <ArrowRight size={11} />
        </p>
      )}
    </>
  )

  const cls =
    'surface rounded-2xl p-5 flex flex-col group hover:-translate-y-0.5 hover:shadow-card transition-all duration-200 list-appear'

  return (
    <div style={{ animationDelay: `${index * 50}ms` }}>
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </div>
  )
}
