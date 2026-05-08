import * as XLSX from 'xlsx'
import type { Client } from '@/types'
import { CLIENT_STATUS_LABELS, formatDate, formatCurrency } from './utils'

export function exportClientsToXLSX(clients: Client[]): void {
  const rows = clients.map((c) => ({
    Nombre: c.name,
    Empresa: c.company ?? '',
    Email: c.email,
    Teléfono: c.phone ?? '',
    País: c.country ?? '',
    Ciudad: c.city ?? '',
    Estado: CLIENT_STATUS_LABELS[c.status] ?? c.status,
    'Tipo de Servicio': c.serviceType ?? '',
    'MRR (USD)': c.mrr,
    'Inicio Contrato': c.contractStart ? formatDate(c.contractStart) : '',
    'Fin Contrato': c.contractEnd ? formatDate(c.contractEnd) : '',
    'Fecha Alta': formatDate(c.createdAt),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes')

  // Auto-size columns
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String(r[key as keyof typeof r]).length)) + 2,
  }))
  ws['!cols'] = colWidths

  XLSX.writeFile(wb, `clientes_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export function exportClientsToCSV(clients: Client[]): void {
  const headers = ['Nombre', 'Empresa', 'Email', 'Teléfono', 'País', 'Estado', 'Servicio', 'MRR']
  const rows = clients.map((c) =>
    [
      c.name, c.company ?? '', c.email, c.phone ?? '',
      c.country ?? '', CLIENT_STATUS_LABELS[c.status], c.serviceType ?? '', c.mrr,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
  )

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
