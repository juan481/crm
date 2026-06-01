'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2,
  Download, ChevronRight, Users, SkipForward,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModalFooter } from '@/components/ui/modal'
import toast from 'react-hot-toast'

interface ParsedRow {
  name: string
  email: string
  phone: string
  company: string
  position: string
  country: string
  city: string
}

interface ImportResult {
  created: number
  skipped: number
  errors: string[]
}

interface ImportClientsProps {
  onSuccess: () => void
  onCancel: () => void
}

// Column name variations accepted (case-insensitive)
const COL_MAP: Record<keyof ParsedRow, string[]> = {
  name:     ['nombre', 'name', 'razón social', 'razon social'],
  email:    ['email', 'correo', 'mail', 'e-mail'],
  phone:    ['teléfono', 'telefono', 'phone', 'tel', 'celular', 'móvil', 'movil'],
  company:  ['empresa', 'company', 'organización', 'organizacion', 'negocio'],
  position: ['cargo', 'position', 'rol', 'puesto'],
  country:  ['país', 'pais', 'country'],
  city:     ['ciudad', 'city'],
}

function detectColumn(headers: string[]): Partial<Record<keyof ParsedRow, number>> {
  const map: Partial<Record<keyof ParsedRow, number>> = {}
  headers.forEach((h, idx) => {
    const normalized = h.toLowerCase().trim()
    for (const [field, aliases] of Object.entries(COL_MAP)) {
      if (aliases.some(a => normalized.includes(a))) {
        if (!(field in map)) (map as Record<string, number>)[field] = idx
      }
    }
  })
  return map
}

function parseSheet(workbook: XLSX.WorkBook): { rows: ParsedRow[]; errors: string[] } {
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })

  if (raw.length < 2) return { rows: [], errors: ['El archivo está vacío o no tiene datos'] }

  const headers = (raw[0] as string[]).map(h => String(h ?? ''))
  const colMap  = detectColumn(headers)

  if (colMap.name === undefined && colMap.email === undefined) {
    return { rows: [], errors: ['No se encontraron columnas de Nombre ni Email. Verificá el archivo.'] }
  }

  const rows: ParsedRow[] = []
  const errors: string[]  = []

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as string[]
    const name  = colMap.name  !== undefined ? String(row[colMap.name]  ?? '').trim() : ''
    const email = colMap.email !== undefined ? String(row[colMap.email] ?? '').trim() : ''
    if (!name && !email) continue
    if (!email) { errors.push(`Fila ${i + 1}: sin email (${name || 'sin nombre'})`); continue }
    rows.push({
      name:     name || email.split('@')[0],
      email:    email.toLowerCase(),
      phone:    colMap.phone    !== undefined ? String(row[colMap.phone]    ?? '').trim() : '',
      company:  colMap.company  !== undefined ? String(row[colMap.company]  ?? '').trim() : '',
      position: colMap.position !== undefined ? String(row[colMap.position] ?? '').trim() : '',
      country:  colMap.country  !== undefined ? String(row[colMap.country]  ?? '').trim() : '',
      city:     colMap.city     !== undefined ? String(row[colMap.city]     ?? '').trim() : '',
    })
  }

  return { rows, errors }
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Email', 'Teléfono', 'Empresa', 'Cargo', 'País', 'Ciudad'],
    ['Juan García', 'juan@empresa.com', '1155667788', 'Empresa SA', 'Gerente', 'Argentina', 'Buenos Aires'],
    ['María López', 'maria@corp.com', '1133445566', 'Corp SRL', 'Directora', 'Argentina', 'Córdoba'],
  ])
  ws['!cols'] = [16, 24, 14, 18, 14, 12, 14].map(w => ({ wch: w }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Contactos')
  XLSX.writeFile(wb, 'plantilla_importacion.xlsx')
}

export function ImportClients({ onSuccess, onCancel }: ImportClientsProps) {
  const [rows, setRows]         = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef                = useRef<HTMLInputElement>(null)

  const processFile = (file: File) => {
    setResult(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const { rows: parsed, errors } = parseSheet(wb)
        setRows(parsed)
        setParseErrors(errors)
        if (parsed.length === 0 && errors.length === 0) {
          setParseErrors(['No se encontraron filas con datos válidos'])
        }
      } catch {
        setParseErrors(['Error al leer el archivo. Asegurate de que sea un .xlsx o .csv válido'])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      processFile(file)
    } else {
      toast.error('Solo se aceptan archivos .xlsx, .xls o .csv')
    }
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients: rows }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setResult({ created: json.created, skipped: json.skipped, errors: json.errors ?? [] })
      toast.success(json.message)
    } catch {
      toast.error('Error al importar')
    } finally {
      setImporting(false)
    }
  }

  // ── Result screen ─────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${result.created > 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
            {result.created > 0
              ? <CheckCircle2 size={36} className="text-emerald-400" />
              : <AlertCircle  size={36} className="text-amber-400" />
            }
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--color-text)]">Importación completada</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="surface-raised rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{result.created}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Contactos importados</p>
          </div>
          <div className="surface-raised rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-[var(--color-text-muted)]">{result.skipped}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Omitidos / ya existían</p>
          </div>
        </div>
        {result.errors.length > 0 && (
          <div className="surface-raised rounded-xl p-3">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">Registros con error:</p>
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-400">{e}</p>
            ))}
          </div>
        )}
        <ModalFooter>
          <Button onClick={() => { onSuccess() }}>Ver contactos</Button>
        </ModalFooter>
      </div>
    )
  }

  // ── Upload + preview ──────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Template download */}
      <div className="flex items-center justify-between p-3 surface-raised rounded-xl">
        <p className="text-xs text-[var(--color-text-muted)]">
          Descargá la plantilla para asegurarte del formato correcto
        </p>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline font-medium shrink-0"
        >
          <Download size={13} />
          Plantilla Excel
        </button>
      </div>

      {/* Drop zone */}
      {rows.length === 0 ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
              : 'border-[var(--color-border-strong)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-raised)]'
          }`}
        >
          <FileSpreadsheet size={36} className="mx-auto mb-3 text-emerald-400 opacity-80" />
          <p className="text-sm font-medium text-[var(--color-text)]">Subí tu archivo Excel o CSV</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Arrastrá o hacé clic · .xlsx, .xls, .csv</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* File info + clear */}
          <div className="flex items-center gap-3 p-3 surface-raised rounded-xl">
            <FileSpreadsheet size={20} className="text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">{fileName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{rows.length} filas detectadas</p>
            </div>
            <button
              onClick={() => { setRows([]); setFileName(''); setParseErrors([]) }}
              className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
              {parseErrors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-amber-400">{e}</p>
              ))}
              {parseErrors.length > 5 && <p className="text-xs text-amber-400">y {parseErrors.length - 5} más...</p>}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <Users size={14} />, label: 'Contactos', value: rows.length, color: 'text-blue-400 bg-blue-500/10' },
              { icon: <ChevronRight size={14} />, label: 'Con empresa', value: rows.filter(r => r.company).length, color: 'text-indigo-400 bg-indigo-500/10' },
              { icon: <SkipForward size={14} />, label: 'Con cargo', value: rows.filter(r => r.position).length, color: 'text-violet-400 bg-violet-500/10' },
            ].map(s => (
              <div key={s.label} className="surface-raised rounded-xl p-3 text-center">
                <div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center mx-auto mb-1`}>{s.icon}</div>
                <p className="text-base font-bold text-[var(--color-text)]">{s.value}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest mb-2">
              Vista previa (primeros {Math.min(rows.length, 8)})
            </p>
            <div className="surface-raised rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      {['Nombre', 'Email', 'Empresa', 'Cargo'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[var(--color-text-subtle)] font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {rows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="hover:bg-[var(--color-surface-overlay)]">
                        <td className="px-3 py-2 text-[var(--color-text)] font-medium truncate max-w-[120px]">{row.name}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)] truncate max-w-[140px]">{row.email}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)] truncate max-w-[100px]">{row.company || '—'}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)] truncate max-w-[80px]">{row.position || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 8 && (
                <p className="text-center text-xs text-[var(--color-text-subtle)] py-2 border-t border-[var(--color-border)]">
                  + {rows.length - 8} filas más
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <ModalFooter>
        <Button variant="ghost" onClick={onCancel} type="button">Cancelar</Button>
        {rows.length > 0 && (
          <Button
            onClick={handleImport}
            loading={importing}
            leftIcon={<Upload size={15} />}
          >
            Importar {rows.length} contactos
          </Button>
        )}
      </ModalFooter>
    </div>
  )
}
