// ─── Enums ────────────────────────────────────────────────────────────────
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'SELLER'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_PAYMENT' | 'EXPIRED' | 'PROSPECT'
export type ClientType = 'B2B' | 'B2C'
export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
export type NoteType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'TASK'
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
  createdAt: string
}

// ─── Note / Timeline (legacy) ─────────────────────────────────────────────
export interface Note {
  id: string
  content: string
  type: NoteType
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
  pendingPayment: number
  expiredServices: number
  mrr: number
  mrrGrowth: number
  newClientsThisMonth: number
  revenueByMonth: { month: string; revenue: number }[]
  clientsByStatus: { status: string; count: number }[]
  pendingTasks: number
  openTickets: number
  activeDealsCount: number
  pipelineValue: number
  dealsByStage: Record<string, number>
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
  clientId: string | null
  client?: { id: string; name: string; company: string | null } | null
  ownerId: string
  owner?: { id: string; name: string }
  organizationId: string
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
  assignedToId: string
  assignedTo?: { id: string; name: string }
  createdById: string
  createdBy?: { id: string; name: string }
  clientId: string | null
  client?: { id: string; name: string } | null
  organizationId: string
  createdAt: string
  updatedAt: string
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
  assignedToId: string | null
  assignedTo?: { id: string; name: string } | null
  createdById: string
  createdBy?: { id: string; name: string }
  resolvedAt: string | null
  organizationId: string
  messages?: TicketMessage[]
  _count?: { messages: number }
  createdAt: string
  updatedAt: string
}

export interface TicketMessage {
  id: string
  ticketId: string
  content: string
  isInternal: boolean
  userId: string
  user?: { id: string; name: string; avatarUrl: string | null }
  createdAt: string
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
