// ─── Enums ────────────────────────────────────────────────────────────────
// GREMIO (Módulo 3, portal B2B) es un carril lateral — no participa de la
// jerarquía interna de canAccess()/AppShell, ver comentario en el enum Role
// del schema. Se agrega igual al union type para que TS lo reconozca en
// altas/ediciones de usuario y en los guards explícitos del portal.
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'SELLER' | 'TECHNICIAN' | 'HR' | 'GREMIO'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_PAYMENT' | 'EXPIRED' | 'PROSPECT'
export type ClientType = 'B2B' | 'B2C'
export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
export type NoteType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'CHAT'
export type ActivityAction =
  | 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'TASK'
  | 'CLIENT_CREATED' | 'CLIENT_UPDATED' | 'CLIENT_DELETED'
  | 'SALE_REGISTERED' | 'DOCUMENT_UPLOADED' | 'STATUS_CHANGED'
export type CampaignStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED'
export type DealStage = 'LEAD' | 'CONTACTADO' | 'PROPUESTA' | 'NEGOCIACION' | 'GANADO' | 'PERDIDO'
export type TaskStatus = 'PENDIENTE' | 'EN_CURSO' | 'HECHA'
export type TaskPriority = 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'
export type TicketStatus = 'ABIERTO' | 'EN_PROCESO' | 'ESPERANDO' | 'RESUELTO' | 'CERRADO'
export type TicketCategory = 'SOPORTE' | 'BUG' | 'FACTURACION' | 'CONSULTA'
export type CotizacionStatus = 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA'
export type EmpresaNotaTipo = 'NOTA' | 'LLAMADA' | 'REUNION' | 'EMAIL' | 'ENVIO_COTIZACION'
export type SmtpProvider = 'SMTP' | 'SES'
export type BillingCycle = 'MENSUAL' | 'ANUAL' | 'UNICO'

// ─── Organization ─────────────────────────────────────────────────────────
export interface Organization {
  id: string
  name: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  domain: string | null
  crmName: string
  createdAt: string
  updatedAt: string
}

// ─── User ─────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  name: string
  role: Role
  status: UserStatus
  onboardingCompleted: boolean
  forcePasswordChange: boolean
  avatarUrl: string | null
  organizationId: string
  organization?: Organization
  createdAt: string
  updatedAt: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────
export interface AuthPayload {
  userId: string
  orgId: string
  role: Role
  email: string
}

export interface LoginCredentials {
  email: string
  password: string
}

// ─── Client ───────────────────────────────────────────────────────────────
export interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  country: string | null
  city: string | null
  address: string | null
  postalCode: string | null
  province: string | null
  website: string | null
  status: ClientStatus
  isEnabled: boolean
  clientType: ClientType
  serviceType: string | null
  tags: string[]
  mrr: number
  contractStart: string | null
  contractEnd: string | null
  // Licencia
  licenseSerial: string | null
  licenseVersion: string | null
  maxWorkstations: number | null
  subscriptionStart: string | null
  subscriptionEnd: string | null
  licenseHibernated: boolean
  licenseRepurchased: boolean
  isActive24x7: boolean
  // Comercial
  distributorName: string | null
  totalInvestment: number | null
  renewalCount: number
  assignedSellerId: string | null
  assignedSeller?: { id: string; name: string } | null
  organizationId: string
  createdAt: string
  updatedAt: string
  invoices?: Invoice[]
  notes?: Note[]
  activityLogs?: ActivityLog[]
  contacts?: Contact[]
  sales?: Sale[]
}

export interface ClientFilters {
  search?: string
  status?: ClientStatus | ''
  isEnabled?: boolean | null
  clientType?: ClientType | ''
  country?: string
  serviceType?: string
  assignedSellerId?: string
  page?: number
  limit?: number
}

// ─── Contact ──────────────────────────────────────────────────────────────
export interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  role: string | null
  clientId: string
  createdAt: string
}

// ─── Invoice ──────────────────────────────────────────────────────────────
export interface Invoice {
  id: string
  clientId: string
  amount: number
  currency: string
  status: InvoiceStatus
  description: string | null
  dueDate: string
  paidAt: string | null
  organizationId: string
  createdAt: string
  updatedAt: string
}

// ─── Cotizacion ───────────────────────────────────────────────────────────
export interface Cotizacion {
  id: string
  number: number
  status: CotizacionStatus
  clientId: string | null
  client?: { id: string; name: string } | null
  empresaId: string | null
  empresa?: { id: string; name: string } | null
  contactName: string | null
  contactEmail: string | null
  items: string
  subtotal: number
  discount: number
  finalTotal: number
  currency: string
  validUntil: string | null
  notes: string | null
  organizationId: string
  createdById: string
  createdBy?: { id: string; name: string }
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

// ─── Empresa Nota ─────────────────────────────────────────────────────────
export interface EmpresaNota {
  id: string
  empresaId: string
  userId: string
  user?: { id: string; name: string; avatarUrl: string | null }
  tipo: EmpresaNotaTipo
  contenido: string
  organizationId: string
  createdAt: string
}

// ─── Note / Timeline ──────────────────────────────────────────────────────
export interface Note {
  id: string
  content: string
  type: NoteType
  metadata?: string | null
  clientId: string
  userId: string
  user?: { name: string; avatarUrl: string | null }
  createdAt: string
}

// ─── Activity Log ─────────────────────────────────────────────────────────
export interface ActivityLog {
  id: string
  clientId: string
  userId: string
  user?: { name: string; avatarUrl: string | null }
  action: ActivityAction
  description: string
  metadata?: string | null
  createdAt: string
}

// ─── Sale ─────────────────────────────────────────────────────────────────
export interface Sale {
  id: string
  clientId: string
  sellerId: string
  seller?: { id: string; name: string }
  serviceId: string | null
  service?: { id: string; name: string; currency: string } | null
  amount: number
  currency: string
  closedAt: string
  notes: string | null
  createdAt: string
}

// ─── Service ──────────────────────────────────────────────────────────────
export interface Service {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  billingCycle: string
  organizationId: string
  createdAt: string
  _count?: { clients: number }
}

// ─── Product catalog ──────────────────────────────────────────────────────
export interface Product {
  id:             string
  name:           string
  description:    string | null
  price:          number
  currency:       string
  unit:           string
  trackStock:     boolean
  stock:          number
  organizationId: string
  createdAt:      string
  // ── Catálogo de productos (Módulo 1) — null en productos "simples" ──
  sku?:                  string | null
  brand?:                string | null
  mpn?:                  string | null
  categoryId?:           string | null
  category?:             { id: string; name: string; parentId: string | null } | null
  imageUrl?:             string | null
  costo?:                number | null
  ivaPct?:               number | null
  precioGremio?:         number | null
  supplier?:             string | null
  supplierAvailability?: string | null
  active?:               boolean
  catalogSource?:        string | null
  lastSyncedAt?:         string | null
  // ── Producto KIT / compuesto ──────────────────────────────────────────
  isKit?:                boolean
  kitComponents?:        KitComponent[]
}

export interface KitComponent {
  id:          string
  quantity:    number
  componentId: string
  component: {
    id:         string
    name:       string
    sku:        string | null
    price:      number
    currency:   string
    costo:      number | null
    stock:      number
    trackStock: boolean
  }
}

// Un KIT es un Product con isKit=true. Se cotiza como 1 línea / 1 precio
// (Product.price). El desglose (kitComponents) y el margen son sólo internos.
export interface Kit extends Product {
  isKit:          true
  kitComponents:  KitComponent[]
  componentesSubtotal: number  // Σ component.price × qty (precio público)
  componentesCosto:    number  // Σ component.costo  × qty
  margen:              number  // price − componentesSubtotal
  margenPct:           number
  algunComponenteSinStock: boolean
}

export interface ProductCategory {
  id: string
  name: string
  productCount: number
  children?: { id: string; name: string; productCount: number }[]
}

export interface ProductBrand {
  value: string
  count: number
}

// ─── Quote ────────────────────────────────────────────────────────────────
export interface QuoteItem {
  type:          'SERVICE' | 'PRODUCT'
  serviceId?:    string
  productId?:    string
  name:          string
  price:         number
  currency:      string
  billingCycle?: string
  unit?:         string
  quantity:      number
}

// ─── RRHH ─────────────────────────────────────────────────────────────────
export interface Asistencia {
  id:             string
  userId:         string
  user?:          { id: string; name: string; role: string; avatarUrl: string | null }
  organizationId: string
  fecha:          string
  horaEntrada:    string | null
  horaSalida:     string | null
  ausente:        boolean
  tardanza:       boolean
  observaciones:  string | null
  creadoPorId:    string | null
  createdAt:      string
  updatedAt:      string
}

// ─── Plugin System ────────────────────────────────────────────────────────
export interface PluginDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: 'communication' | 'analytics' | 'integration' | 'productivity'
  version: string
  author: string
  requiresConfig: boolean
  configSchema?: Record<string, { type: string; label: string; required: boolean }>
  // Whether toggling this plugin actually changes anything in the app today.
  // Most of these were shipped as placeholders — only advanced-analytics is wired up.
  implemented: boolean
  // Rubros (ids de src/lib/verticals.ts) que ven este plugin en su catálogo.
  // Sin declarar = visible para todos los rubros (así ningún plugin existente
  // le cambia a Abba lo que ya ve hoy).
  verticals?: string[]
}

export interface PluginConfig {
  id: string
  pluginId: string
  enabled: boolean
  config: Record<string, unknown> | null
  organizationId: string
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────
export interface DashboardMetrics {
  activeClients: number
  newClientsThisMonth: number
  pendingTasks: number
  openTickets: number
  activeDealsCount: number
  // Nunca sumar entre monedas — mismo criterio que mrrByCurrency más abajo.
  pipelineValueByCurrency: Record<string, number>
  dealsByStage: Record<string, number>
  cotizacionesEnviadas: number
  cotizacionesAceptadas: number
  newLeadsThisMonth: number
  recentLeads: { id: string; title: string; origen: string | null; createdAt: string }[]
  // Bloque financiero — undefined para roles sin acceso (hoy: SELLER). El
  // backend (api/dashboard/metrics/route.ts) ni siquiera corre esas
  // queries ni las manda en el JSON para esos roles — no es sólo un
  // ocultamiento visual. Chequear `!== undefined` antes de renderizar.
  pendingPayment?: number
  overdueInvoices?: number
  // Nunca sumar entre monedas — ver formatMultiCurrency en @/lib/utils.
  mrrByCurrency?: Record<string, number>
  mrrGrowthByCurrency?: Record<string, number>
  revenueByMonth?: { month: string; byCurrency: Record<string, number> }[]
  invoicesByStatus?: { status: string; count: number }[]
  topClientsByRevenue?: { id: string; name: string; total: number; currency: string }[]
}

// ─── Email Campaign ────────────────────────────────────────────────────────
export interface EmailCampaign {
  id: string
  name: string
  subject: string
  body: string
  status: CampaignStatus
  organizationId: string
  sentAt: string | null
  createdAt: string
  updatedAt: string
  _count?: { recipients: number }
  // Destinatarios con status='sent' realmente — a diferencia de
  // _count.recipients (todos, cualquier status). Ver GET
  // /api/communications/campaigns.
  sentCount?: number
  // SES tracking aggregates (available after migration + SES config)
  totalDelivered?: number
  totalBounced?: number
  totalSpam?: number
  totalOpened?: number
}

// ─── Email Template ───────────────────────────────────────────────────────
export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  organizationId: string
  createdById: string
  createdBy?: { name: string }
  createdAt: string
  updatedAt: string
}

// ─── Event ────────────────────────────────────────────────────────────────
export interface Event {
  id: string
  name: string
  description: string | null
  eventDate: string | null
  location: string | null
  isActive: boolean
  webhookSecret: string
  organizationId: string
  createdAt: string
  updatedAt: string
  _count?: { attendees: number }
  attendees?: EventAttendee[]
}

export interface EventAttendee {
  id: string
  eventId: string
  firstName: string
  lastName: string
  company: string | null
  phone: string | null
  country: string | null
  email: string | null
  source: string
  createdAt: string
}

// ─── Documents ────────────────────────────────────────────────────────────
export interface Folder {
  id: string
  name: string
  parentId: string | null
  clientId: string | null
  organizationId: string
  createdAt: string
  children?: Folder[]
  documents?: Document[]
  _count?: { documents: number; children: number }
}

export interface Document {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  url: string
  folderId: string | null
  clientId: string | null
  organizationId: string
  tags: string[]
  uploadedById: string
  uploadedBy?: { name: string }
  version: number
  supersedesId: string | null
  createdAt: string
}

// ─── Deal / Pipeline ──────────────────────────────────────────────────────
export interface Deal {
  id: string
  title: string
  amount: number
  currency: string
  probability: number
  stage: DealStage
  expectedCloseDate: string | null
  closedAt: string | null
  notes: string | null
  origen: string | null
  leadReason: string | null
  empresaId: string | null
  empresa?: { id: string; name: string; city?: string | null } | null
  clientId: string | null
  client?: { id: string; name: string; company: string | null } | null
  contactoId: string | null
  contacto?: { id: string; firstName: string; lastName: string; phone: string | null } | null
  ownerId: string
  owner?: { id: string; name: string }
  organizationId: string
  cotizaciones?: Array<{ id: string; ref: string; finalTotal: number; currency: string; status: string; createdAt: string }>
  createdAt: string
  updatedAt: string
}

// ─── Task ─────────────────────────────────────────────────────────────────
export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  completedAt: string | null
  viewedAt: string | null
  assignedToId: string
  assignedTo?: { id: string; name: string; avatarUrl?: string | null }
  createdById: string
  createdBy?: { id: string; name: string }
  clientId: string | null
  client?: { id: string; name: string } | null
  empresaId: string | null
  empresa?: { id: string; name: string } | null
  dealId: string | null
  deal?: { id: string; title: string } | null
  ticketId: string | null
  ticket?: { id: string; number: number; title: string } | null
  organizationId: string
  // Colaboradores adicionales — no obligatorio, ver TaskCollaborator.
  collaborators?: Array<{ user: { id: string; name: string; avatarUrl: string | null } }>
  createdAt: string
  updatedAt: string
}

export interface TaskSubitem {
  id: string
  taskId: string
  title: string
  done: boolean
  order: number
  createdAt: string
}

export interface TaskComment {
  id: string
  taskId: string
  content: string
  attachmentUrl?: string | null
  attachmentName?: string | null
  userId: string
  user?: { id: string; name: string; avatarUrl: string | null }
  createdAt: string
}

// ─── Ticket ───────────────────────────────────────────────────────────────
export interface Ticket {
  id: string
  number: number
  title: string
  description: string
  status: TicketStatus
  priority: TaskPriority
  category: TicketCategory
  clientId: string | null
  client?: { id: string; name: string } | null
  empresaId: string | null
  empresa?: { id: string; name: string } | null
  recipientEmail?: string | null
  recipientName?: string | null
  assignedToId: string | null
  assignedTo?: { id: string; name: string; avatarUrl?: string | null } | null
  createdById: string
  createdBy?: { id: string; name: string }
  resolvedAt: string | null
  slaDueAt: string | null
  satisfactionToken: string | null
  satisfactionRating: number | null
  satisfactionComment: string | null
  satisfactionRatedAt: string | null
  organizationId: string
  messages?: TicketMessage[]
  _count?: { messages: number }
  // Colaboradores adicionales — no obligatorio, ver TicketCollaborator.
  collaborators?: Array<{ user: { id: string; name: string; avatarUrl: string | null } }>
  createdAt: string
  updatedAt: string
}

export interface TicketMessage {
  id: string
  ticketId: string
  content: string
  isInternal: boolean
  attachmentUrl?: string | null
  attachmentName?: string | null
  userId: string
  user?: { id: string; name: string; avatarUrl: string | null }
  createdAt: string
}

// ─── Directorio ───────────────────────────────────────────────────────────
export interface Empresa {
  id: string
  name: string
  isCliente: boolean
  clienteDesde: string | null
  activity: string | null
  address: string | null
  codigoPostal: string | null
  city: string | null
  province: string | null
  country: string | null
  website: string | null
  monthlyAmount: number | null
  billingCurrency: string
  cuit: string | null
  condicionIva: string | null
  formaPagoHabitual: string | null
  // Cartera de Ventas — reparto de trabajo, no aislamiento (ver schema).
  ownerId: string | null
  owner?: { id: string; name: string } | null
  organizationId: string
  createdAt: string
  updatedAt: string
  _count?: { contactos: number }
  contactos?: DirectorioContacto[]
}

export interface DirectorioContacto {
  id: string
  firstName: string
  lastName: string
  companyRaw: string | null
  role: string | null
  email: string | null
  phone: string | null
  empresaId: string | null
  empresa?: { id: string; name: string } | null
  organizationId: string
  createdAt: string
  updatedAt: string
  // Oportunidades de Pipeline donde este contacto es la persona (Deal.contactoId).
  deals?: Array<{
    id: string
    title: string
    stage: DealStage
    amount: number
    currency: string
    expectedCloseDate: string | null
  }>
}

// ─── API Response wrapper ─────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
