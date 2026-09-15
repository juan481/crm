import { prisma } from '../src/lib/db'

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'Abba Seguridad' }, select: { id: true } })
  if (!org) throw new Error('org not found')

  const legacyClient = await prisma.client.findFirst({ where: { organizationId: org.id } })
  if (!legacyClient) throw new Error('no legacy client found to simulate with')

  // Simulate exactly what generate-recurring/route.ts creates: clientId set, no empresaId
  const testInvoice = await prisma.invoice.create({
    data: {
      clientId: legacyClient.id,
      organizationId: org.id,
      amount: 1000,
      currency: 'USD',
      description: 'TEST — simulated recurring invoice (no empresaId)',
      dueDate: new Date(),
      status: 'PENDING',
    },
  })
  console.log('Created test invoice:', testInvoice.id, 'empresaId:', testInvoice.empresaId, 'clientId:', testInvoice.clientId)

  try {
    // Exactly the query used by GET /api/invoices
    const fetched = await prisma.invoice.findMany({
      where: { organizationId: org.id, id: testInvoice.id },
      include: {
        empresa: { select: { id: true, name: true } },
        client:  { select: { id: true, name: true } },
      },
    })
    console.log('Fetched with include:', JSON.stringify(fetched, null, 2))

    const row = fetched[0]
    // Exactly the fallback logic used in facturas/page.tsx
    const clientName = row.empresa?.name ?? row.client?.name ?? 'Sin cliente'
    console.log('Resolved display name:', clientName)
    if (!clientName || clientName === 'Sin cliente' && row.client) {
      throw new Error('Fallback did not resolve client name correctly')
    }
  } finally {
    await prisma.invoice.delete({ where: { id: testInvoice.id } })
    console.log('Cleaned up test invoice.')
  }
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) }).finally(() => prisma.$disconnect())
