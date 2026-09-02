import { prisma } from '@/lib/db'

// Arma el transcript completo de una conversación de WhatsApp como texto
// plano, para pegarlo como nota (DealNota tipo CHAT / TicketMessage interno)
// cuando NISSI deriva — así el humano que la toma ve todo el contexto sin
// tener que abrir el inbox. Mismo espíritu que scripts/import-abba-leads.ts,
// que ya guarda el chat completo como DealNota tipo CHAT.

const MAX_TRANSCRIPT_CHARS = 15000

export async function buildConversationTranscript(conversationId: string): Promise<string> {
  const db = prisma as any
  const msgs = await db.whatsAppMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      content: true,
      createdAt: true,
      sender: { select: { name: true } },
    },
  })

  const lines: string[] = msgs.map((m: any) => {
    const who = m.role === 'user'
      ? 'Cliente'
      : m.sender?.name
        ? m.sender.name
        : 'NISSI'
    return `${who}: ${m.content}`
  })

  let text = lines.join('\n')
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    text = text.slice(0, MAX_TRANSCRIPT_CHARS) + '\n…(transcript truncado)'
  }
  return `— Conversación de WhatsApp (vía NISSI) —\n\n${text}`
}
