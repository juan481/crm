'use client'

// Campo "Retira" con sugerencias de usuarios internos (Norma, Sergio,
// técnicos...) vía <datalist> — sigue siendo texto libre a propósito
// (EntregaStock.retiradoPor no es un User: también puede ser flete o gente
// de la obra), pero ahora el usuario puede elegir en vez de escribir a ciegas.
// Pedido de Abba (Seba, 2026-10-01): el remito traía "A definir" y no dejaba
// elegir quién firma/retira.

import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'

const DATALIST_ID = 'retira-usuarios-crm'

export function RetiraInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  const { data } = useQuery({
    queryKey: ['usuarios-retira'],
    queryFn: async () => (await fetch('/api/usuarios')).json(),
    staleTime: 5 * 60_000,
  })
  const nombres: string[] = (data?.data ?? []).map((u: any) => u.name).filter(Boolean)

  return (
    <>
      <Input
        list={DATALIST_ID}
        value={value === 'A definir' ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Norma, Sergio, técnico, flete..."
        autoFocus={autoFocus}
      />
      <datalist id={DATALIST_ID}>
        {nombres.map((n) => <option key={n} value={n} />)}
      </datalist>
    </>
  )
}
