import { prisma } from '../src/lib/db'

const TEST_ORG_NAME = 'Agencia Digital Pro' // seed/demo org, never Abba

async function main() {
  const db = prisma as any

  // 1. Confirm Juan resolves as platform admin (mirrors getPlatformAdmin()'s query)
  const juan = await db.user.findUnique({
    where: { email: 'juancruzrossi1@gmail.com' },
    select: { id: true, status: true, isPlatformAdmin: true },
  })
  console.log('1. Juan platform-admin check:', juan, '-> isPlatformAdmin:', juan?.status === 'ACTIVE' && juan?.isPlatformAdmin)

  // 2. Org list (mirrors GET /api/admin/organizations)
  const orgs = await db.organization.findMany({
    select: { id: true, name: true, suspended: true, suspendedAt: true, _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  })
  console.log('2. Org list:', orgs)

  const testOrg = orgs.find((o: any) => o.name === TEST_ORG_NAME)
  if (!testOrg) throw new Error(`Test org "${TEST_ORG_NAME}" not found`)

  // 3. Suspend the test org (mirrors PATCH /api/admin/organizations/[id])
  await db.organization.update({ where: { id: testOrg.id }, data: { suspended: true, suspendedAt: new Date() } })
  console.log('3. Suspended test org.')

  // 4. Confirm a user in that org now fails the getCurrentUser() suspension check
  const testUser = await db.user.findFirst({
    where: { organizationId: testOrg.id },
    select: { id: true, email: true, status: true, organization: { select: { suspended: true } } },
  })
  const wouldBeBlocked = !testUser || testUser.status !== 'ACTIVE' || testUser.organization.suspended
  console.log('4. Test user in suspended org:', testUser?.email, '-> getCurrentUser() would return null:', wouldBeBlocked)

  // 5. Confirm data intact (user count unchanged) while suspended
  const countWhileSuspended = await db.user.count({ where: { organizationId: testOrg.id } })
  console.log('5. User count while suspended:', countWhileSuspended, '(should match original _count.users =', testOrg._count.users, ')')

  // 6. Reactivate
  await db.organization.update({ where: { id: testOrg.id }, data: { suspended: false, suspendedAt: null } })
  const reactivated = await db.organization.findUnique({ where: { id: testOrg.id }, select: { suspended: true, suspendedAt: true } })
  console.log('6. Reactivated:', reactivated)

  const countAfterReactivate = await db.user.count({ where: { organizationId: testOrg.id } })
  console.log('7. User count after reactivate:', countAfterReactivate, '(should be unchanged)')
}

main().finally(() => prisma.$disconnect())
