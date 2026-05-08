'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

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
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
              isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            )}
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div className="flex-1">
        <p className="text-2xl font-bold text-[var(--color-text)] mb-0.5">{value}</p>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">{title}</p>
        {(subtitle || trendLabel) && (
          <p className="text-xs text-[var(--color-text-subtle)] mt-1">{trendLabel ?? subtitle}</p>
        )}
      </div>

      {href && (
        <p className="flex items-center gap-1 mt-3 text-xs font-medium text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
          Ver detalle <ArrowRight size={11} />
        </p>
      )}
    </>
  )

  const cls = 'surface rounded-2xl p-5 flex flex-col group hover:-translate-y-0.5 hover:shadow-card transition-all duration-200'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      {href ? (
        <Link href={href} className={cls}>{inner}</Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </motion.div>
  )
}
