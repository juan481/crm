const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, crmName: true, domain: true }
  });
  console.log('Organizations in DB:');
  for (const org of orgs) {
    const clientsCount = await prisma.client.count({ where: { organizationId: org.id } });
    const empresasCount = await prisma.empresa.count({ where: { organizationId: org.id } });
    const contactosCount = await prisma.directorioContacto.count({ where: { organizationId: org.id } });
    console.log(`- ID: "${org.id}" | Name: "${org.name}" | CRM: "${org.crmName}" | Domain: "${org.domain}"`);
    console.log(`  Counts: Clients=${clientsCount}, Empresas=${empresasCount}, Contactos=${contactosCount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
