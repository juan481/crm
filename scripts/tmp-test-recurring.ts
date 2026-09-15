import { prisma } from '../src/lib/db'

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: 'Abba Seguridad' }, select: { id: true } })
  if (!org) throw new Error('org not found')

  const empresa = await prisma.empresa.findFirst({ where: { organizationId: org.id, isCliente: true } })
  if (!empresa) throw new Error('no cliente empresa found')

  // Set a temporary monthlyAmount to simulate a recurring-billing empresa
  await prisma.empresa.update({ where: { id: empresa.id }, data: { monthlyAmount: 15000, billingCurrency: 'ARS' } })
  console.log('Set monthlyAmount on', empresa.name)

  try {
    // Mirror the GET preview query
    const billable = await prisma.empresa.findMany({
      where: { organizationId: org.id, isCliente: true, monthlyAmount: { gt: 0 } },
      select: { id: true, name: true, monthlyAmount: true, billingCurrency: true },
    })
    console.log('Billable empresas:', billable)

    // Mirror the POST creation for just this one empresa
    const dueDate = new Date()
    const invoice = await prisma.invoice.create({
      data: {
        empresaId: empresa.id,
        organizationId: org.id,
        amount: empresa.monthlyAmount ?? 15000,
        currency: 'ARS',
        description: 'TEST recurring invoice',
        dueDate,
        status: 'PENDING',
      },
    })
    console.log('Created test invoice:', invoice.id)

    // Confirm it would now show as "already billed" this month
    const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1)
    const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 1)
    const already = await prisma.invoice.findMany({
      where: { empresaId: { in: [empresa.id] }, createdAt: { gte: startOfMonth, lt: endOfMonth } },
      select: { empresaId: true },
    })
    console.log('Already billed this month (should include our empresa):', already)

    await prisma.invoice.delete({ where: { id: invoice.id } })
    console.log('Cleaned up test invoice.')
  } finally {
    await prisma.empresa.update({ where: { id: empresa.id }, data: { monthlyAmount: null, billingCurrency: 'USD' } })
    console.log('Reverted empresa billing fields.')
  }
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) }).finally(() => prisma.$disconnect())
