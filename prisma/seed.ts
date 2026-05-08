import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ─── Organización ────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { domain: 'default.local' },
    update: {},
    create: {
      name: 'Agencia Digital Pro',
      crmName: 'CRM Pro',
      domain: 'default.local',
      primaryColor: '#6366f1',
      secondaryColor: '#8b5cf6',
    },
  })

  // ─── Usuarios ────────────────────────────────────────────────────
  const superAdminHash = await bcrypt.hash('Admin123!', 12)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@crmpro.com' },
    update: {},
    create: {
      email: 'superadmin@crmpro.com',
      name: 'Carlos Méndez',
      passwordHash: superAdminHash,
      role: 'SUPER_ADMIN',
      organizationId: org.id,
      onboardingCompleted: true,
    },
  })

  const adminHash = await bcrypt.hash('Admin123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crmpro.com' },
    update: {},
    create: {
      email: 'admin@crmpro.com',
      name: 'Laura Gómez',
      passwordHash: adminHash,
      role: 'ADMIN',
      organizationId: org.id,
      onboardingCompleted: true,
    },
  })

  const sellerHash = await bcrypt.hash('Seller123!', 12)
  const seller = await prisma.user.upsert({
    where: { email: 'vendedor@crmpro.com' },
    update: {},
    create: {
      email: 'vendedor@crmpro.com',
      name: 'Martín Torres',
      passwordHash: sellerHash,
      role: 'SELLER',
      organizationId: org.id,
      onboardingCompleted: true,
    },
  })

  // ─── Clientes ────────────────────────────────────────────────────
  const clientsData = [
    {
      name: 'TechCorp Argentina',
      email: 'contacto@techcorp.com.ar',
      phone: '+54 11 4321-0000',
      company: 'TechCorp SA',
      country: 'Argentina',
      city: 'Buenos Aires',
      status: 'ACTIVE',
      mrr: 2200,
      serviceType: 'SEO + Google Ads',
      clientType: 'B2B',
      contractStart: new Date('2024-01-15'),
      contractEnd: new Date('2025-01-15'),
      website: 'https://techcorp.com.ar',
    },
    {
      name: 'Moda & Style',
      email: 'hola@modaystyle.com',
      phone: '+54 351 555-1234',
      company: 'Moda & Style SRL',
      country: 'Argentina',
      city: 'Córdoba',
      status: 'ACTIVE',
      mrr: 950,
      serviceType: 'Social Media + Diseño',
      clientType: 'B2B',
      contractStart: new Date('2024-03-01'),
      contractEnd: new Date('2025-03-01'),
    },
    {
      name: 'Panadería Don José',
      email: 'donjose@panaderiadj.com',
      phone: '+54 11 4567-8901',
      company: 'Panadería Don José',
      country: 'Argentina',
      city: 'Rosario',
      status: 'PENDING_PAYMENT',
      mrr: 380,
      serviceType: 'Web Design',
      clientType: 'B2C',
      contractStart: new Date('2024-05-10'),
    },
    {
      name: 'Global Exports LLC',
      email: 'ceo@globalexports.com',
      phone: '+1 305 555-0199',
      company: 'Global Exports LLC',
      country: 'Estados Unidos',
      city: 'Miami',
      status: 'ACTIVE',
      mrr: 4500,
      serviceType: 'Full Service Digital',
      clientType: 'B2B',
      contractStart: new Date('2023-09-01'),
      contractEnd: new Date('2025-09-01'),
      website: 'https://globalexports.com',
    },
    {
      name: 'Constructora Vega',
      email: 'gerencia@constructoravega.com',
      phone: '+54 261 444-5555',
      company: 'Constructora Vega SA',
      country: 'Argentina',
      city: 'Mendoza',
      status: 'EXPIRED',
      mrr: 0,
      serviceType: 'Google Ads',
      clientType: 'B2B',
      contractStart: new Date('2023-06-01'),
      contractEnd: new Date('2024-06-01'),
    },
    {
      name: 'Fintech Soluciones',
      email: 'ops@fintechsol.io',
      phone: '+54 11 2233-4455',
      company: 'Fintech Soluciones SA',
      country: 'Argentina',
      city: 'Buenos Aires',
      status: 'ACTIVE',
      mrr: 5800,
      serviceType: 'SEO + Contenido + Ads',
      clientType: 'B2B',
      contractStart: new Date('2023-11-01'),
      contractEnd: new Date('2025-11-01'),
      website: 'https://fintechsol.io',
    },
    {
      name: 'Restaurante El Fogón',
      email: 'reservas@elfogon.com',
      phone: '+54 11 6677-8899',
      company: 'El Fogón SRL',
      country: 'Argentina',
      city: 'Buenos Aires',
      status: 'ACTIVE',
      mrr: 620,
      serviceType: 'Social Media',
      clientType: 'B2C',
      contractStart: new Date('2024-06-01'),
    },
    {
      name: 'Clínica Salud Total',
      email: 'admin@saludtotal.com',
      phone: '+54 11 5544-3322',
      company: 'Clínica Salud Total',
      country: 'Argentina',
      city: 'Buenos Aires',
      status: 'ACTIVE',
      mrr: 1800,
      serviceType: 'SEO + Web',
      clientType: 'B2B',
      contractStart: new Date('2024-02-15'),
      contractEnd: new Date('2025-02-15'),
    },
  ]

  const createdClients: Record<string, string> = {}
  for (const c of clientsData) {
    const existing = await prisma.client.findFirst({ where: { email: c.email, organizationId: org.id } })
    const client = existing ?? await prisma.client.create({ data: { ...c, tags: '[]', organizationId: org.id } })
    createdClients[c.name] = client.id
  }

  // ─── Contactos ───────────────────────────────────────────────────
  const contactsData = [
    { clientName: 'TechCorp Argentina', name: 'Roberto Álvarez', email: 'roberto@techcorp.com.ar', phone: '+54 11 4321-0001', role: 'Director General' },
    { clientName: 'TechCorp Argentina', name: 'Sofía Ruiz', email: 'sofia@techcorp.com.ar', phone: '+54 11 4321-0002', role: 'Marketing Manager' },
    { clientName: 'Global Exports LLC', name: 'Michael Johnson', email: 'mjohnson@globalexports.com', phone: '+1 305 555-0100', role: 'CEO' },
    { clientName: 'Fintech Soluciones', name: 'Valentina Cruz', email: 'vcruz@fintechsol.io', phone: '+54 11 2233-4456', role: 'CMO' },
    { clientName: 'Fintech Soluciones', name: 'Diego Herrera', email: 'dherrera@fintechsol.io', phone: '+54 11 2233-4457', role: 'CTO' },
    { clientName: 'Clínica Salud Total', name: 'Dra. Ana Martínez', email: 'direccion@saludtotal.com', phone: '+54 11 5544-3300', role: 'Directora Médica' },
  ]

  for (const c of contactsData) {
    const clientId = createdClients[c.clientName]
    if (!clientId) continue
    const exists = await prisma.contact.findFirst({ where: { email: c.email, clientId } })
    if (!exists) {
      await prisma.contact.create({ data: { name: c.name, email: c.email, phone: c.phone, role: c.role, clientId } })
    }
  }

  // ─── Facturas ────────────────────────────────────────────────────
  const now = new Date()
  const invoicesData = [
    { clientName: 'TechCorp Argentina', amount: 2200, currency: 'USD', status: 'PAID', description: 'Servicio SEO + Ads - Mayo 2025', dueDate: new Date('2025-05-01') },
    { clientName: 'TechCorp Argentina', amount: 2200, currency: 'USD', status: 'PENDING', description: 'Servicio SEO + Ads - Junio 2025', dueDate: new Date('2025-06-01') },
    { clientName: 'Fintech Soluciones', amount: 5800, currency: 'USD', status: 'PAID', description: 'Full Service Digital - Mayo 2025', dueDate: new Date('2025-05-01') },
    { clientName: 'Fintech Soluciones', amount: 5800, currency: 'USD', status: 'PENDING', description: 'Full Service Digital - Junio 2025', dueDate: new Date('2025-06-01') },
    { clientName: 'Global Exports LLC', amount: 4500, currency: 'USD', status: 'PAID', description: 'Full Service Digital - Mayo 2025', dueDate: new Date('2025-05-05') },
    { clientName: 'Panadería Don José', amount: 380, currency: 'USD', status: 'OVERDUE', description: 'Web Design - Abril 2025', dueDate: new Date('2025-04-10') },
    { clientName: 'Moda & Style', amount: 950, currency: 'USD', status: 'PAID', description: 'Social Media - Mayo 2025', dueDate: new Date('2025-05-01') },
    { clientName: 'Clínica Salud Total', amount: 1800, currency: 'USD', status: 'PAID', description: 'SEO + Web - Mayo 2025', dueDate: new Date('2025-05-10') },
  ]

  for (const inv of invoicesData) {
    const clientId = createdClients[inv.clientName]
    if (!clientId) continue
    const exists = await prisma.invoice.findFirst({ where: { description: inv.description, clientId } })
    if (!exists) {
      await prisma.invoice.create({ data: { amount: inv.amount, currency: inv.currency, status: inv.status, description: inv.description, dueDate: inv.dueDate, clientId } })
    }
  }

  // ─── Plugins ─────────────────────────────────────────────────────
  const defaultPlugins = ['email-campaigns', 'export-data', 'global-search', 'advanced-analytics']
  for (const pluginId of defaultPlugins) {
    await prisma.pluginConfig.upsert({
      where: { pluginId_organizationId: { pluginId, organizationId: org.id } },
      update: { enabled: true },
      create: { pluginId, enabled: true, organizationId: org.id },
    })
  }

  // ─── Deals ───────────────────────────────────────────────────────
  const dealsData = [
    { title: 'SEO Anual - TechCorp 2026',      amount: 26400, currency: 'USD', probability: 75, stage: 'NEGOCIACION', clientName: 'TechCorp Argentina',  ownerId: seller.id },
    { title: 'Full Service - Moda & Style',    amount: 14400, currency: 'USD', probability: 50, stage: 'PROPUESTA',   clientName: 'Moda & Style',         ownerId: seller.id },
    { title: 'Rediseño Web - Panadería DJ',    amount: 2800,  currency: 'USD', probability: 25, stage: 'CONTACTADO',  clientName: 'Panadería Don José',    ownerId: superAdmin.id },
    { title: 'Expansión Digital - Global Exp', amount: 60000, currency: 'USD', probability: 10, stage: 'LEAD',        clientName: 'Global Exports LLC',    ownerId: superAdmin.id },
    { title: 'Reactivación - Constructora',    amount: 7200,  currency: 'USD', probability: 25, stage: 'CONTACTADO',  clientName: 'Constructora Vega',     ownerId: seller.id },
    { title: 'Pack Premium - Fintech',         amount: 84000, currency: 'USD', probability: 75, stage: 'NEGOCIACION', clientName: 'Fintech Soluciones',    ownerId: superAdmin.id },
    { title: 'Campaña Ads - El Fogón',         amount: 3600,  currency: 'USD', probability: 50, stage: 'PROPUESTA',   clientName: 'Restaurante El Fogón',  ownerId: seller.id },
  ]

  for (const deal of dealsData) {
    const exists = await prisma.deal.findFirst({ where: { title: deal.title, organizationId: org.id } })
    if (!exists) {
      const clientId = createdClients[deal.clientName]
      await prisma.deal.create({
        data: { title: deal.title, amount: deal.amount, currency: deal.currency, probability: deal.probability, stage: deal.stage, clientId: clientId || null, ownerId: deal.ownerId, organizationId: org.id },
      })
    }
  }

  // ─── Tareas ──────────────────────────────────────────────────────
  const tasksData = [
    { title: 'Llamar a TechCorp para revisión de campaña',   priority: 'ALTA',    status: 'PENDIENTE', dueDate: new Date(Date.now() + 2 * 86400000),  clientName: 'TechCorp Argentina',  assignedId: seller.id },
    { title: 'Enviar propuesta de diseño a Moda & Style',    priority: 'MEDIA',   status: 'EN_CURSO',  dueDate: new Date(Date.now() + 5 * 86400000),  clientName: 'Moda & Style',         assignedId: seller.id },
    { title: 'Gestionar pago pendiente de Panadería Don José', priority: 'URGENTE', status: 'PENDIENTE', dueDate: new Date(Date.now() + 1 * 86400000), clientName: 'Panadería Don José',   assignedId: admin.id },
    { title: 'Preparar informe de resultados Q1 - Global',   priority: 'MEDIA',   status: 'PENDIENTE', dueDate: new Date(Date.now() + 7 * 86400000),  clientName: 'Global Exports LLC',   assignedId: superAdmin.id },
    { title: 'Renovar contrato Fintech Soluciones',          priority: 'ALTA',    status: 'EN_CURSO',  dueDate: new Date(Date.now() + 14 * 86400000), clientName: 'Fintech Soluciones',   assignedId: superAdmin.id },
    { title: 'Seguimiento post-reunión El Fogón',            priority: 'BAJA',    status: 'HECHA',     dueDate: null,                                  clientName: 'Restaurante El Fogón', assignedId: seller.id },
    { title: 'Actualizar reporte mensual de keywords',       priority: 'MEDIA',   status: 'PENDIENTE', dueDate: new Date(Date.now() + 3 * 86400000),  clientName: 'Clínica Salud Total',  assignedId: admin.id },
    { title: 'Revisar métricas de conversión - Fintech',     priority: 'ALTA',    status: 'HECHA',     dueDate: null,                                  clientName: 'Fintech Soluciones',   assignedId: superAdmin.id },
  ]

  for (const task of tasksData) {
    const exists = await prisma.task.findFirst({ where: { title: task.title, organizationId: org.id } })
    if (!exists) {
      const clientId = createdClients[task.clientName]
      await prisma.task.create({
        data: { title: task.title, priority: task.priority, status: task.status, dueDate: task.dueDate, clientId: clientId || null, assignedToId: task.assignedId, createdById: superAdmin.id, organizationId: org.id },
      })
    }
  }

  // ─── Tickets ─────────────────────────────────────────────────────
  const lastTicket = await prisma.ticket.findFirst({ where: { organizationId: org.id }, orderBy: { number: 'desc' } })
  let ticketNum = (lastTicket?.number ?? 0) + 1

  const ticketsData = [
    {
      title: 'Error en reporte de Analytics',
      description: 'El reporte semanal no muestra datos de los últimos 3 días. Necesito los datos urgente para una presentación con el directorio.',
      status: 'EN_PROCESO', priority: 'ALTA', category: 'BUG',
      clientName: 'TechCorp Argentina', assignedId: admin.id,
    },
    {
      title: 'Consulta sobre factura de mayo',
      description: 'Hay un cargo extra de $200 en la factura de mayo que no reconozco. ¿Pueden explicarme a qué corresponde?',
      status: 'ABIERTO', priority: 'MEDIA', category: 'FACTURACION',
      clientName: 'Moda & Style', assignedId: null,
    },
    {
      title: 'Campaña Google Ads sin conversiones',
      description: 'Llevamos 3 semanas de campaña y el CTR es muy bajo. Las palabras clave no parecen estar funcionando. Por favor revisar la configuración completa.',
      status: 'ESPERANDO', priority: 'ALTA', category: 'SOPORTE',
      clientName: 'Global Exports LLC', assignedId: seller.id,
    },
    {
      title: 'Cambio de responsable de cuenta',
      description: 'A partir del 1 de junio el contacto de cuenta es Juan Pérez (juan@fintechsol.io / +54 11 2233-9999). Por favor actualizar los datos.',
      status: 'RESUELTO', priority: 'BAJA', category: 'CONSULTA',
      clientName: 'Fintech Soluciones', assignedId: admin.id,
    },
    {
      title: 'Solicitud de nuevo servicio - Email Marketing',
      description: 'Estamos interesados en agregar email marketing a nuestro plan actual. ¿Pueden enviarnos una propuesta con precios y alcance?',
      status: 'ABIERTO', priority: 'MEDIA', category: 'CONSULTA',
      clientName: 'Clínica Salud Total', assignedId: null,
    },
  ]

  for (const ticket of ticketsData) {
    const exists = await prisma.ticket.findFirst({ where: { title: ticket.title, organizationId: org.id } })
    if (!exists) {
      const clientId = createdClients[ticket.clientName]
      const created = await prisma.ticket.create({
        data: { title: ticket.title, description: ticket.description, status: ticket.status, priority: ticket.priority, category: ticket.category, number: ticketNum++, clientId: clientId || null, assignedToId: ticket.assignedId, createdById: superAdmin.id, organizationId: org.id },
      })
      // Agregar mensaje de ejemplo al primer ticket
      if (ticket.status === 'EN_PROCESO') {
        await prisma.ticketMessage.create({
          data: { ticketId: created.id, content: 'Recibimos tu reporte. Estamos investigando el problema con el sistema de analytics. Te informamos en las próximas horas.', isInternal: false, userId: admin.id },
        })
        await prisma.ticketMessage.create({
          data: { ticketId: created.id, content: 'Parece ser un problema con la integración de GA4. Escalé al equipo técnico.', isInternal: true, userId: superAdmin.id },
        })
      }
    }
  }

  // ─── Activity logs ───────────────────────────────────────────────
  const activitiesData = [
    { clientName: 'TechCorp Argentina', action: 'NOTE', description: 'Reunión mensual con Roberto - muy satisfecho con los resultados de SEO (+40% orgánico este mes)' },
    { clientName: 'TechCorp Argentina', action: 'CALL', description: 'Llamada de seguimiento - confirmaron renovación del contrato para 2026' },
    { clientName: 'Fintech Soluciones', action: 'MEETING', description: 'Reunión de kickoff para nueva campaña de contenidos - participaron CMO y CTO' },
    { clientName: 'Fintech Soluciones', action: 'NOTE', description: 'Cliente muy satisfecho con el ROI del Q1: 3.2x en Google Ads' },
    { clientName: 'Constructora Vega', action: 'CALL', description: 'Contacto para reactivar servicio - evalúan presupuesto para H2 2025' },
    { clientName: 'Panadería Don José', action: 'NOTE', description: 'Envié 2 recordatorios de pago sin respuesta. Escalar a admin.' },
    { clientName: 'Global Exports LLC', action: 'EMAIL', description: 'Enviado reporte mensual de resultados con métricas detalladas' },
    { clientName: 'Moda & Style', action: 'MEETING', description: 'Presentación del calendario de contenidos para julio/agosto - aprobado con cambios menores' },
  ]

  for (const act of activitiesData) {
    const clientId = createdClients[act.clientName]
    if (!clientId) continue
    const exists = await prisma.activityLog.findFirst({ where: { description: act.description, clientId } })
    if (!exists) {
      await prisma.activityLog.create({ data: { clientId, userId: superAdmin.id, action: act.action, description: act.description } })
    }
  }

  console.log('✅ Seed completado')
  console.log('📧 superadmin@crmpro.com / Admin123!  (Super Admin)')
  console.log('📧 admin@crmpro.com / Admin123!       (Admin)')
  console.log('📧 vendedor@crmpro.com / Seller123!   (Vendedor)')
}

main().catch(console.error).finally(() => prisma.$disconnect())
