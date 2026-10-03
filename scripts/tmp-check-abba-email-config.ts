import { prisma } from '../src/lib/db'

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'Abba', mode: 'insensitive' } },
    select: {
      name: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpFrom: true,
      smtpProvider: true, sesRegion: true, sesFrom: true, sesConfigSet: true,
      sesAccessKeyId: true, sesSecretKey: true,
      billingEmail: true,
    },
  })
  console.log(org)
}
main().finally(() => prisma.$disconnect())
