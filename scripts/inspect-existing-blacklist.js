const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectExisting() {
  const orgId = 'cmske462000008ahb29n2427g';
  const abba = await prisma.empresa.findFirst({
    where: { organizationId: orgId, name: { contains: 'Abba', mode: 'insensitive' } },
    include: {
      contactos: true,
      deals: true,
      invoices: true,
      tickets: true
    }
  });
  const sg = await prisma.empresa.findFirst({
    where: { organizationId: orgId, name: { contains: 'SoftGuard', mode: 'insensitive' } },
    include: {
      contactos: true,
      deals: true,
      invoices: true,
      tickets: true
    }
  });

  console.log('Abba in Just Create:', JSON.stringify(abba, null, 2));
  console.log('Softguard in Just Create:', JSON.stringify(sg, null, 2));
}

inspectExisting().catch(console.error).finally(() => prisma.$disconnect());
