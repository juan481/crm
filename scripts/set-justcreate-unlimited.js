const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgId = 'cmske462000008ahb29n2427g'; // Just Create
  
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: { emailMonthlyLimit: 1000000 },
    select: { id: true, name: true, emailMonthlyLimit: true }
  });

  console.log(`✓ Límite de emails mensuales actualizado exitosamente:`);
  console.log(`- Organización: "${updated.name}" (${updated.id})`);
  console.log(`- Nuevo Límite: ${updated.emailMonthlyLimit.toLocaleString()} (Ilimitado / Propietario)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
