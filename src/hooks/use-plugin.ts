'use client'

import { useQuery } from '@tanstack/react-query'

interface PluginState {
  id: string
  enabled: boolean
  config: Record<string, unknown> | null
}

export function usePlugins(): PluginState[] {
  const { data = [] } = useQuery<PluginState[]>({
    queryKey: ['plugins'],
    queryFn: async () => {
      const res = await fetch('/api/plugins')
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
  return data
}

export function usePlugin(id: string): { enabled: boolean; config: Record<string, unknown> | null } {
  const plugins = usePlugins()
  const plugin = plugins.find((p) => p.id === id)
  return { enabled: plugin?.enabled ?? false, config: plugin?.config ?? null }
}
