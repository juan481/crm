# CRM White-Label Pro

CRM modular, escalable y de marca blanca (White-Label SaaS) para agencias y empresas de servicios.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Estilos | Tailwind CSS + CSS Variables dinámicas |
| Base de datos | PostgreSQL (Supabase) + Prisma ORM |
| Auth | Supabase Auth (JWT + httpOnly cookies) |
| Email | Amazon SES / Nodemailer / Brevo |
| Estado global | Zustand |
| Gráficos | Recharts |
| Exportación | XLSX / CSV |
| Animaciones | Framer Motion |
| Deploy | Vercel |

---

## Setup inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

Crea `.env` en la raíz con:

```env
# Base de datos (Supabase)
DATABASE_URL="postgresql://..."

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# App
NEXT_PUBLIC_APP_URL="https://tudominio.com"
JWT_SECRET="..."

# Email — Amazon SES (opcional, si se usa SES)
AWS_SES_REGION="us-east-1"
AWS_SES_ACCESS_KEY_ID="..."
AWS_SES_SECRET_ACCESS_KEY="..."
AWS_SES_CONFIG_SET="..."          # nombre del Configuration Set para tracking
AWS_SNS_TOPIC_ARN="arn:aws:sns:..." # ARN del topic SNS para webhooks

# Email — SMTP genérico (fallback)
SMTP_HOST="smtp.ejemplo.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
```

### 3. Inicializar la base de datos

```bash
npm run db:generate   # Genera el Prisma Client
npm run db:push       # Aplica el schema (primera vez o cambios sin data)
npm run db:seed       # Carga datos de prueba
```

> **Migraciones con enums:** Si venís de una versión anterior con columnas `String`, usá el script `prisma/migrations/safe_enum_migration.sql` en el SQL Editor de Supabase antes de `db:push` para convertir sin pérdida de datos.

### 4. Iniciar en desarrollo

```bash
npm run dev
```

Disponible en `http://localhost:3000`

---

## Usuarios de prueba (seed)

| Email | Password | Rol |
|-------|----------|-----|
| superadmin@crmpro.com | Admin123! | Super Admin |
| admin@crmpro.com | Admin123! | Admin |
| vendedor@crmpro.com | Seller123! | Vendedor |

---

## Roles y permisos

El CRM tiene 5 roles con jerarquía numérica (`canAccess`):

| Nivel | Rol | Descripción |
|-------|-----|-------------|
| 4 | `SUPER_ADMIN` | Acceso total, gestión de organización y plugins |
| 3 | `ADMIN` | Gestión operativa completa |
| 2 | `SELLER` | Clientes propios, pipeline, cotizador |
| 1 | `HR` | Módulo RRHH y tareas |
| 0 | `TECHNICIAN` | Tickets y tareas asignados |

### Permisos por módulo

| Módulo | SUPER_ADMIN | ADMIN | SELLER | HR | TECHNICIAN |
|--------|:-----------:|:-----:|:------:|:--:|:----------:|
| Dashboard | ✅ | ✅ | ✅ | — | — |
| Clientes / Empresas | ✅ | ✅ | ✅ (propios) | — | — |
| Pipeline (Deals) | ✅ | ✅ | ✅ (propios) | — | — |
| Cotizador | ✅ | ✅ | ✅ | — | — |
| Tareas | ✅ | ✅ | ✅ | ✅ | ✅ (asignadas) |
| Tickets | ✅ | ✅ | ✅ | — | ✅ (asignados) |
| Comunicaciones | ✅ | ✅ | ✅ | — | — |
| Facturación | ✅ | ✅ | — | — | — |
| RRHH | ✅ | ✅ | — | ✅ | — |
| Mi Día | — | — | — | — | ✅ |
| Configuración | ✅ | ✅ | — | — | — |

---

## Módulos principales

### Email — Amazon SES
- Proveedor configurable por organización: SMTP / Brevo / SES
- Configuración desde `Configuración > Correo`
- Tracking de campañas: entregados, rebotados, abiertos, spam
- Pixel de apertura (`/api/track/open`) + webhooks SNS (`/api/webhooks/ses`)
- Firma SNS verificada con RSA-SHA1 antes de procesar cualquier evento

### Pipeline (Deals)
- SELLER solo puede ver y editar sus propios deals
- ADMIN puede asignar deals a otros usuarios de la misma organización
- SELLER no puede crear deals a nombre de otro usuario

### Tickets de soporte
- Numeración auto-incremental con retry ante colisiones concurrentes (P2002)
- TECHNICIAN solo puede cambiar el estado de tickets asignados a él
- Solo ADMIN+ puede reasignar tickets

### Tareas
- TECHNICIAN puede marcar como leídas/actualizar estado de tareas asignadas
- HR no tiene acceso a tareas de clientes

### Facturación
- Generación recurrente masiva (1 clic por mes)
- Solo ADMIN+ puede ver y generar facturas
- `organizationId` requerido en todos los registros

---

## Estructura del proyecto

```
crm/
├── prisma/
│   ├── schema.prisma          # Schema con enums tipados
│   ├── seed.ts                # Datos de prueba
│   └── migrations/
│       └── safe_enum_migration.sql   # Migración String→Enum sin pérdida de datos
├── src/
│   ├── app/
│   │   ├── (auth)/            # Login + Onboarding
│   │   ├── (dashboard)/       # Páginas del CRM
│   │   └── api/               # API Routes REST
│   │       ├── clients/
│   │       ├── deals/
│   │       ├── tickets/
│   │       ├── tareas/
│   │       ├── invoices/
│   │       ├── communications/
│   │       ├── track/open/    # Pixel de apertura de emails
│   │       ├── webhooks/ses/  # Receptor de eventos SNS/SES
│   │       └── notifications/counts/
│   ├── components/
│   │   ├── ui/                # Componentes base reutilizables
│   │   ├── layout/            # Sidebar + Header
│   │   └── ...
│   ├── lib/
│   │   ├── auth.ts            # canAccess + getCurrentUser
│   │   ├── db.ts              # Prisma client singleton
│   │   └── email.ts           # sendEmail (SES / Brevo / SMTP)
│   └── types/index.ts         # Tipos globales y enums TS
```

---

## Características

- ✅ Arquitectura White-Label multi-tenant
- ✅ Temas dinámicos (colores y logo personalizables por organización)
- ✅ RBAC con 5 roles jerárquicos y scoping por recurso
- ✅ Amazon SES con tracking completo (delivery, bounce, open, spam)
- ✅ Webhook SNS con verificación de firma RSA-SHA1
- ✅ Onboarding interactivo paso a paso
- ✅ Dashboard con métricas filtradas por rol
- ✅ Buscador global predictivo
- ✅ Pipeline de ventas (Deals)
- ✅ Sistema de tickets con numeración concurrente segura
- ✅ Generación recurrente de facturas
- ✅ Campañas de email masivas con stats por destinatario
- ✅ Cotizador con PDF (logo proporcional, descuentos)
- ✅ Exportación XLS / CSV
- ✅ Mobile-first responsive
- ✅ Dark mode con toggle

---

## Deploy en Vercel

El deploy es automático al hacer push a `main`. Variables de entorno configuradas en el dashboard de Vercel.

```bash
git push origin main   # dispara deploy automático
```

Para deploy manual:

```bash
npm run build
npm run start
```
