'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { usePlugin } from '@/hooks/use-plugin'
import toast from 'react-hot-toast'

interface Props {
  phone: string
  name?: string
}

// Botón "Enviar WhatsApp" — sólo se renderiza si el plugin está activado
// (self-contained: no hace falta que cada pantalla que lo usa se acuerde
// de chequear usePlugin). Complementa al link directo a wa.me que ya
// existe en varias fichas (ese abre WhatsApp Web/app del usuario; este
// manda el mensaje server-side vía la API de WhatsApp Business, sin
// depender de que el usuario tenga WhatsApp abierto en ese dispositivo).
export function WhatsAppSendButton({ phone, name }: Props) {
  const { enabled } = usePlugin('whatsapp-integration')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  if (!enabled || !phone) return null

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/integrations/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }
      toast.success('Mensaje enviado')
      setOpen(false)
      setMessage('')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors"
        style={{ borderColor: 'rgba(34,197,94,0.3)', color: '#22c55e' }}
      >
        <Send size={12} /> Enviar WhatsApp
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`WhatsApp a ${name ?? phone}`} size="sm">
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Se envía vía la API de WhatsApp Business a <strong>{phone}</strong>. Meta sólo permite texto libre
            dentro de las 24hs desde el último mensaje que este contacto te mandó — fuera de esa ventana el
            envío puede rechazarse.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribí el mensaje..."
            rows={4}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
          />
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSend} loading={sending} disabled={!message.trim()}>Enviar</Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
