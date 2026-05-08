'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, Folder, FileText, FileImage, File, Plus,
  Upload, Trash2, ChevronRight, Home, Download, Tag, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import type { Folder as FolderType, Document } from '@/types'
import toast from 'react-hot-toast'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImage size={20} className="text-blue-400" />
  if (mimeType === 'application/pdf') return <FileText size={20} className="text-red-400" />
  if (mimeType.includes('word')) return <FileText size={20} className="text-sky-400" />
  return <File size={20} className="text-[var(--color-text-subtle)]" />
}

interface BreadcrumbItem { id: string | null; name: string }

export default function DocumentosPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: 'Inicio' }])
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteFolder, setDeleteFolder] = useState<FolderType | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['documents', currentFolderId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (currentFolderId) params.set('folderId', currentFolderId)
      const res = await fetch(`/api/documentos?${params}`)
      if (!res.ok) throw new Error('Error al cargar documentos')
      const json = await res.json()
      return json.data as { folders: FolderType[]; documents: Document[] }
    },
    staleTime: 30 * 1000,
  })

  const folders = data?.folders ?? []
  const documents = data?.documents ?? []

  const navigateToFolder = (folder: FolderType) => {
    setCurrentFolderId(folder.id)
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }])
  }

  const navigateToBreadcrumb = (item: BreadcrumbItem, idx: number) => {
    setCurrentFolderId(item.id)
    setBreadcrumb((prev) => prev.slice(0, idx + 1))
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) { toast.error('El nombre es requerido'); return }
    setCreatingFolder(true)
    try {
      const res = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parentId: currentFolderId }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Carpeta creada')
      setNewFolderName('')
      setShowNewFolder(false)
      qc.invalidateQueries({ queryKey: ['documents', currentFolderId] })
    } catch {
      toast.error('Error al crear')
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    let uploaded = 0
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        if (currentFolderId) formData.append('folderId', currentFolderId)

        const res = await fetch('/api/documentos/upload', { method: 'POST', body: formData })
        const json = await res.json()
        if (!res.ok) { toast.error(`${file.name}: ${json.error}`); continue }
        uploaded++
      }
      if (uploaded > 0) {
        toast.success(`${uploaded} archivo${uploaded !== 1 ? 's' : ''} subido${uploaded !== 1 ? 's' : ''}`)
        qc.invalidateQueries({ queryKey: ['documents', currentFolderId] })
      }
    } catch {
      toast.error('Error al subir')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteDoc = async () => {
    if (!deleteDoc) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/documentos/${deleteDoc.id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); toast.error(j.error); return }
      toast.success('Documento eliminado')
      setDeleteDoc(null)
      qc.invalidateQueries({ queryKey: ['documents', currentFolderId] })
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Documentos</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {documents.length + folders.length > 0
              ? `${folders.length} carpeta${folders.length !== 1 ? 's' : ''} · ${documents.length} archivo${documents.length !== 1 ? 's' : ''}`
              : 'Repositorio de archivos'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            leftIcon={<Plus size={15} />}
            onClick={() => setShowNewFolder(true)}
          >
            Nueva Carpeta
          </Button>
          <Button
            leftIcon={uploading ? undefined : <Upload size={15} />}
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Subir Archivo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".jpg,.jpeg,.png,.pdf,.docx,.txt"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        {breadcrumb.map((item, idx) => (
          <div key={`${item.id}-${idx}`} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight size={14} className="text-[var(--color-text-subtle)]" />}
            <button
              onClick={() => navigateToBreadcrumb(item, idx)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                idx === breadcrumb.length - 1
                  ? 'text-[var(--color-text)] font-medium cursor-default'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]'
              }`}
            >
              {idx === 0 ? <Home size={13} /> : <Folder size={13} />}
              {item.name}
            </button>
          </div>
        ))}
      </div>

      {/* Drop zone hint */}
      <div
        className="surface rounded-2xl p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
      >
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : folders.length === 0 && documents.length === 0 ? (
          <div className="text-center py-14">
            <FolderOpen className="mx-auto mb-3 text-[var(--color-text-subtle)]" size={40} />
            <p className="text-[var(--color-text-muted)] text-sm">
              {currentFolderId ? 'Carpeta vacía' : 'Sin archivos aún'}
            </p>
            <p className="text-xs text-[var(--color-text-subtle)] mt-1">
              Arrastrá archivos aquí o usá el botón "Subir Archivo"
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Folders */}
            {folders.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--color-text-subtle)] uppercase tracking-wide mb-2">
                  Carpetas
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <AnimatePresence initial={false}>
                    {folders.map((folder) => (
                      <motion.div
                        key={folder.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="group relative rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)] p-3.5 cursor-pointer transition-all hover:shadow-sm"
                        onClick={() => navigateToFolder(folder)}
                      >
                        <Folder size={28} className="text-yellow-400 mb-2" />
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">{folder.name}</p>
                        <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">
                          {folder._count?.children ?? 0} carpeta{(folder._count?.children ?? 0) !== 1 ? 's' : ''} ·{' '}
                          {folder._count?.documents ?? 0} archivo{(folder._count?.documents ?? 0) !== 1 ? 's' : ''}
                        </p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Documents */}
            {documents.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--color-text-subtle)] uppercase tracking-wide mb-2">
                  Archivos
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence initial={false}>
                    {documents.map((doc) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)] p-3.5 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5">
                            {getMimeIcon(doc.mimeType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text)] truncate" title={doc.name}>
                              {doc.name}
                            </p>
                            <p className="text-xs text-[var(--color-text-subtle)] mt-0.5">
                              {formatSize(doc.size)} · {formatDate(doc.createdAt)}
                            </p>
                            {doc.uploadedBy && (
                              <p className="text-xs text-[var(--color-text-subtle)]">{doc.uploadedBy.name}</p>
                            )}
                            {doc.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {doc.tags.map((tag) => (
                                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions on hover */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={doc.originalName}
                            className="p-1.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={12} />
                          </a>
                          <button
                            onClick={() => setDeleteDoc(doc)}
                            className="p-1.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-subtle)] hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New folder modal */}
      <Modal open={showNewFolder} onClose={() => setShowNewFolder(false)} title="Nueva Carpeta" size="sm">
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <Input
            label="Nombre de la carpeta"
            placeholder="Ej: Contratos 2026"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowNewFolder(false)}>Cancelar</Button>
            <Button type="submit" loading={creatingFolder}>Crear Carpeta</Button>
          </div>
        </form>
      </Modal>

      {/* Delete doc confirm */}
      <Modal open={!!deleteDoc} onClose={() => setDeleteDoc(null)} title="Eliminar Documento" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          ¿Eliminar <strong className="text-[var(--color-text)]">{deleteDoc?.originalName}</strong>? El archivo se eliminará del disco permanentemente.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteDoc(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleDeleteDoc}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
