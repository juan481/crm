-- ============================================================
-- Safe String→Enum migration with USING casts (NO DATA LOSS)
-- Run this in Supabase SQL Editor BEFORE prisma db push
-- ============================================================

-- 1. Create all enum types
CREATE TYPE "Role"             AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SELLER', 'HR', 'TECHNICIAN');
CREATE TYPE "UserStatus"       AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "ClientStatus"     AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_PAYMENT', 'EXPIRED', 'PROSPECT');
CREATE TYPE "ClientType"       AS ENUM ('B2B', 'B2C');
CREATE TYPE "InvoiceStatus"    AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE "NoteType"         AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK', 'CHAT');
CREATE TYPE "ActivityAction"   AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK', 'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_DELETED', 'STATUS_CHANGED', 'SALE_REGISTERED', 'DOCUMENT_UPLOADED');
CREATE TYPE "CampaignStatus"   AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "RecipientStatus"  AS ENUM ('pending', 'sent', 'failed', 'bounced', 'spam');
CREATE TYPE "DealStage"        AS ENUM ('LEAD', 'CONTACTADO', 'PROPUESTA', 'NEGOCIACION', 'GANADO', 'PERDIDO');
CREATE TYPE "TaskStatus"       AS ENUM ('PENDIENTE', 'EN_CURSO', 'HECHA');
CREATE TYPE "Priority"         AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');
CREATE TYPE "TicketStatus"     AS ENUM ('ABIERTO', 'EN_PROCESO', 'ESPERANDO', 'RESUELTO', 'CERRADO');
CREATE TYPE "TicketCategory"   AS ENUM ('SOPORTE', 'BUG', 'FACTURACION', 'CONSULTA');
CREATE TYPE "EmpresaNotaTipo"  AS ENUM ('NOTA', 'LLAMADA', 'REUNION', 'CHAT', 'ENVIO_COTIZACION', 'CONVERSACION', 'SOPORTE');
CREATE TYPE "BillingCycle"     AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');
CREATE TYPE "CotizacionStatus" AS ENUM ('GUARDADA', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA');
CREATE TYPE "SmtpProvider"     AS ENUM ('SMTP', 'SES');

-- 2. User
ALTER TABLE "User" ALTER COLUMN "role"   DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role"   TYPE "Role"       USING "role"::"Role";
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus" USING "status"::"UserStatus";
ALTER TABLE "User" ALTER COLUMN "role"   SET DEFAULT 'SELLER';
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- 3. Client
ALTER TABLE "Client" ALTER COLUMN "status"     DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "clientType" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "status"     TYPE "ClientStatus" USING "status"::"ClientStatus";
ALTER TABLE "Client" ALTER COLUMN "clientType" TYPE "ClientType"   USING "clientType"::"ClientType";
ALTER TABLE "Client" ALTER COLUMN "status"     SET DEFAULT 'ACTIVE';
ALTER TABLE "Client" ALTER COLUMN "clientType" SET DEFAULT 'B2B';

-- 4. ActivityLog
ALTER TABLE "ActivityLog" ALTER COLUMN "action" DROP DEFAULT;
ALTER TABLE "ActivityLog" ALTER COLUMN "action" TYPE "ActivityAction" USING "action"::"ActivityAction";
ALTER TABLE "ActivityLog" ALTER COLUMN "action" SET DEFAULT 'NOTE';

-- 5. CampaignRecipient
ALTER TABLE "CampaignRecipient" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CampaignRecipient" ALTER COLUMN "status" TYPE "RecipientStatus" USING "status"::"RecipientStatus";
ALTER TABLE "CampaignRecipient" ALTER COLUMN "status" SET DEFAULT 'pending';

-- 6. Cotizacion
ALTER TABLE "Cotizacion" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Cotizacion" ALTER COLUMN "status" TYPE "CotizacionStatus" USING "status"::"CotizacionStatus";
ALTER TABLE "Cotizacion" ALTER COLUMN "status" SET DEFAULT 'ENVIADA';

-- 7. Deal
ALTER TABLE "Deal" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Deal" ALTER COLUMN "stage" TYPE "DealStage" USING "stage"::"DealStage";
ALTER TABLE "Deal" ALTER COLUMN "stage" SET DEFAULT 'LEAD';

-- 8. EmailCampaign
ALTER TABLE "EmailCampaign" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "EmailCampaign" ALTER COLUMN "status" TYPE "CampaignStatus" USING "status"::"CampaignStatus";
ALTER TABLE "EmailCampaign" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- 9. EmpresaNota
ALTER TABLE "EmpresaNota" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "EmpresaNota" ALTER COLUMN "tipo" TYPE "EmpresaNotaTipo" USING "tipo"::"EmpresaNotaTipo";
ALTER TABLE "EmpresaNota" ALTER COLUMN "tipo" SET DEFAULT 'NOTA';

-- 10. Invoice
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus" USING "status"::"InvoiceStatus";
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 11. Note
ALTER TABLE "Note" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Note" ALTER COLUMN "type" TYPE "NoteType" USING "type"::"NoteType";
ALTER TABLE "Note" ALTER COLUMN "type" SET DEFAULT 'NOTE';

-- 12. Organization
ALTER TABLE "Organization" ALTER COLUMN "smtpProvider" DROP DEFAULT;
ALTER TABLE "Organization" ALTER COLUMN "smtpProvider" TYPE "SmtpProvider" USING "smtpProvider"::"SmtpProvider";
ALTER TABLE "Organization" ALTER COLUMN "smtpProvider" SET DEFAULT 'SMTP';

-- 13. Service
ALTER TABLE "Service" ALTER COLUMN "billingCycle" DROP DEFAULT;
ALTER TABLE "Service" ALTER COLUMN "billingCycle" TYPE "BillingCycle" USING "billingCycle"::"BillingCycle";
ALTER TABLE "Service" ALTER COLUMN "billingCycle" SET DEFAULT 'MONTHLY';

-- 14. Task
ALTER TABLE "Task" ALTER COLUMN "status"   DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status"   TYPE "TaskStatus" USING "status"::"TaskStatus";
ALTER TABLE "Task" ALTER COLUMN "priority" TYPE "Priority"   USING "priority"::"Priority";
ALTER TABLE "Task" ALTER COLUMN "status"   SET DEFAULT 'PENDIENTE';
ALTER TABLE "Task" ALTER COLUMN "priority" SET DEFAULT 'MEDIA';

-- 15. Ticket
ALTER TABLE "Ticket" ALTER COLUMN "status"   DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "status"   TYPE "TicketStatus"   USING "status"::"TicketStatus";
ALTER TABLE "Ticket" ALTER COLUMN "priority" TYPE "Priority"       USING "priority"::"Priority";
ALTER TABLE "Ticket" ALTER COLUMN "category" TYPE "TicketCategory" USING "category"::"TicketCategory";
ALTER TABLE "Ticket" ALTER COLUMN "status"   SET DEFAULT 'ABIERTO';
ALTER TABLE "Ticket" ALTER COLUMN "priority" SET DEFAULT 'MEDIA';
ALTER TABLE "Ticket" ALTER COLUMN "category" SET DEFAULT 'SOPORTE';

-- 16. Indexes
CREATE INDEX IF NOT EXISTS "Client_organizationId_status_idx"  ON "Client"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Client_status_idx"                 ON "Client"("status");
CREATE INDEX IF NOT EXISTS "Client_clientType_idx"             ON "Client"("clientType");
CREATE INDEX IF NOT EXISTS "Deal_organizationId_stage_idx"     ON "Deal"("organizationId", "stage");
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx"                ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Task_organizationId_status_idx"    ON "Task"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Ticket_organizationId_status_idx"  ON "Ticket"("organizationId", "status");
