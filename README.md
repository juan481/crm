# CRM White-Label Pro

CRM modular, escalable y de marca blanca (White-Label SaaS) para agencias digitales y empresas.

---

## Stack Tecnológico

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Estilos:** Tailwind CSS + Poppins + CSS Variables dinámicas
- **Animaciones:** Framer Motion
- **Base de datos:** PostgreSQL + Prisma ORM
- **Auth:** JWT custom (httpOnly cookies)
- **Estado global:** Zustand
- **Gráficos:** Recharts
- **Email:** Nodemailer
- **Exportación:** XLSX / CSV

---

## Setup inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de PostgreSQL y SMTP.

### 3. Inicializar la base de datos

```bash
npm run db:generate   # Genera el Prisma Client
npm run db:push       # Aplica el schema a la DB
npm run db:seed       # Carga datos iniciales
```

### 4. Iniciar en desarrollo

```bash
npm run dev
```

La app estará disponible en `http://localhost:3000`

---

## Usuarios de prueba (seed)

| Email | Password | Rol |
|-------|----------|-----|
| superadmin@crmpro.com | Admin123! | Super Admin |
| admin@crmpro.com | Admin123! | Admin |
| vendedor@crmpro.com | Seller123! | Vendedor |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/         # Login + Onboarding
│   ├── (dashboard)/    # Layout + todas las páginas del CRM
│   └── api/            # API Routes (REST)
├── components/
│   ├── ui/             # Componentes base reutilizables
│   ├── layout/         # Sidebar + Header
│   ├── dashboard/      # MetricCard, Charts
│   ├── clients/        # ClientForm, ClientTimeline, ExportMenu
│   ├── communications/ # CampaignComposer
│   └── settings/       # BrandingForm, etc.
├── lib/                # auth, db, utils, export, email
├── plugins/            # Sistema de plugins + definiciones
├── store/              # Zustand stores (theme, auth)
└── types/              # TypeScript types globales
```

---

## Roles y permisos

| Función | Super Admin | Admin | Vendedor |
|---------|------------|-------|----------|
| Ver dashboard | ✅ | ✅ | ✅ |
| Gestionar clientes | ✅ | ✅ | ✅ |
| Comunicaciones | ✅ | ✅ | ❌ |
| Gestión de usuarios | ✅ | ✅ | ❌ |
| Plugins | ✅ | ❌ | ❌ |
| Branding / Marca Blanca | ✅ | ❌ | ❌ |

---

## Características

- ✅ Arquitectura White-Label multi-tenant
- ✅ Temas dinámicos (colores en tiempo real)
- ✅ Logo y nombre del CRM personalizable
- ✅ Onboarding interactivo paso a paso
- ✅ Dashboard con métricas y gráficos
- ✅ Buscador global predictivo
- ✅ Filtros avanzados por estado, país, servicio
- ✅ Exportación XLS / CSV
- ✅ Timeline de actividad por cliente
- ✅ Campañas de email individuales y masivas
- ✅ Sistema de plugins activables/desactivables
- ✅ Error boundaries (cero pantallas en blanco)
- ✅ Mobile-first responsive
- ✅ Dark mode por defecto con toggle

---

## Deploy en VPS

```bash
npm run build
npm run start
```

Se recomienda usar PM2 + Nginx como reverse proxy:

```bash
pm2 start npm --name "crm" -- start
```
