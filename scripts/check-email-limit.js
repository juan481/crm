const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const org = await prisma.organization.findUnique({
    where: { id: 'cmske462000008ahb29n2427g' },
    select: { id: true, name: true, emailMonthlyLimit: true }
  });
  console.log('Just Create org:', org);

  const usage = await prisma.emailUsageMonthly.findMany({
    where: { organizationId: 'cmske462000008ahb29n2427g' }
  });
  console.log('Usage records:', usage);
}

check().catch(console.error).finally(() => prisma.$disconnect());
