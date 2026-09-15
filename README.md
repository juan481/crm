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

# Pagos & Portal (opcional — sin esto no se cobra online, nada más rompe)
WHOP_API_KEY="..."           # cobros en USD
WHOP_PRODUCT_ID="prod_..."   # product de Whop bajo el que se crean los planes
WHOP_WEBHOOK_SECRET="ws_..."
MP_ACCESS_TOKEN="APP_USR-..."  # cobros en ARS (Mercado Pago)
MP_WEBHOOK_SECRET="..."        # clave secreta de Webhooks del panel de MP
```

> Detalle completo de Pagos & Portal (setup de Whop/MP, webhooks, portal de
> clientes, seguridad): **`docs/PAGOS-Y-PORTAL.md`**.

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

### Bot de WhatsApp con IA (NISSI)
- Integración oficial con WhatsApp Cloud API.
- Motor de IA avanzado para calificar leads, responder consultas de clientes, y derivar a humanos.
- Inbox de conversaciones con handover humano, estado de lectura y control de SLA.

### Catálogo Gremio (B2B)
- Portal lateral exclusivo para clientes `GREMIO`.
- Doble lista de precios (Público / Gremio) sincronizada opcionalmente vía Excel o Google Sheets.
- Control de stock y carrito de pedidos B2B integrado al flujo interno del CRM.

### Compras y OCR
- Módulo de proveedores y registro de gastos.
- Extracción automática de datos desde PDFs/imágenes usando IA (OCR) con fallback manual.
- Tracking de márgenes reales cruzando ventas vs costos de compras.

### Facturación y Pagos Online
- Integraciones nativas con Whop (USD) y MercadoPago (ARS) para cobro de abonos automáticos y pago de facturas sueltas.
- Generación recurrente masiva inteligente.

### Directorio (Empresas y Contactos)
- Arquitectura robusta separando Entidades (Empresa) de Personas (Contactos).
- Historial omnicanal centralizado: cada interacción (nota, mail, whatsapp, reunión) queda en el timeline de la empresa o el contacto.

---

## Estructura del proyecto

```
crm/
├── prisma/
│   ├── schema.prisma          # Schema con enums tipados y nueva arquitectura (Empresa/Contacto)
│   ├── seed.ts                # Datos de prueba
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/            # Login + Onboarding
│   │   ├── (dashboard)/       # Páginas internas del CRM (Directorio, Pipeline, etc.)
│   │   ├── (gremio)/          # Portal B2B (Módulo Gremio)
│   │   ├── (portal)/          # Portal de Clientes (Autogestión y Pagos)
│   │   └── api/               # API Routes REST
│   │       ├── whatsapp/      # Webhooks y endpoints del Bot IA
│   │       ├── webhooks/ses/  # Receptor de eventos SNS/SES
│   │       └── ...
│   ├── components/
│   ├── lib/
│   │   ├── auth.ts            # canAccess + getCurrentUser
│   │   ├── db.ts              # Prisma client singleton
│   │   └── ...
│   └── types/index.ts         # Tipos globales y enums TS
```

---

## Características

- ✅ Arquitectura White-Label multi-tenant con temas dinámicos
- ✅ RBAC jerárquico + portales laterales (`GREMIO`, `CLIENTE`)
- ✅ Bot de WhatsApp (NISSI) con IA para ventas y soporte
- ✅ Directorio relacional (Empresas y Contactos) con timeline omnicanal
- ✅ Pagos Online y Abonos con Whop/MercadoPago
- ✅ Catálogo B2B Gremio con dual-pricing
- ✅ Procesamiento OCR de comprobantes de compras
- ✅ Amazon SES con tracking completo de campañas (delivery, bounce, open, spam)
- ✅ Onboarding interactivo paso a paso
- ✅ Dashboard con métricas y alertas de rentabilidad
- ✅ Buscador global predictivo optimizado
- ✅ Pipeline de ventas (Deals) y cotizador con exportación a PDF
- ✅ Exportación de grillas a XLS / CSV
- ✅ Interfaz Mobile-first responsive y Dark Mode nativo

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

