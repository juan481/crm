const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const orgId = 'cmske462000008ahb29n2427g';
  const sampleEmpresa = await prisma.empresa.findFirst({
    where: { organizationId: orgId, name: 'SECURION' },
    include: { contactos: true }
  });
  console.log('Sample Empresa SECURION:');
  console.log(`- ID: ${sampleEmpresa.id}`);
  console.log(`- Name: ${sampleEmpresa.name}`);
  console.log(`- Country: ${sampleEmpresa.country}`);
  console.log(`- Contactos count: ${sampleEmpresa.contactos.length}`);
  console.log(`- Sample Contactos:`, sampleEmpresa.contactos.slice(0, 3).map(c => `${c.firstName} ${c.lastName} (${c.email})`));

  const sampleMendoza = await prisma.empresa.findFirst({
    where: { organizationId: orgId, province: 'Mendoza' },
    include: { contactos: true }
  });
  console.log('\nSample Mendoza Empresa:');
  console.log(`- Name: ${sampleMendoza.name}`);
  console.log(`- Address: ${sampleMendoza.address}`);
  console.log(`- Contactos:`, sampleMendoza.contactos.map(c => `${c.firstName} ${c.lastName} (${c.email})`));

  const sampleCordoba = await prisma.empresa.findFirst({
    where: { organizationId: orgId, province: 'Córdoba' },
    include: { contactos: true }
  });
  console.log('\nSample Córdoba Exposeg Empresa:');
  console.log(`- Name: ${sampleCordoba.name}`);
  console.log(`- Activity: ${sampleCordoba.activity}`);
  console.log(`- Contactos:`, sampleCordoba.contactos.map(c => `${c.firstName} ${c.lastName} (${c.email}) - Cargo: ${c.role} - Tel: ${c.phone}`));
}

verify().catch(console.error).finally(() => prisma.$disconnect());
