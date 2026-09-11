# Pagos & Portal de clientes

Cobro online de facturas (Whop para USD, Mercado Pago para ARS), recordatorios
automáticos, débito automático y un portal para que el cliente vea/pague sus
facturas y pida soporte.

Branch: `feature/pagos-portal-clientes`.

---

## 1. Poner en marcha (orden)

### 1.1 Schema

```bash
cd "D:\JustCreate\Clientes\Claude Proyectos\crm"
npm run db:generate
# revisar que no haya DROP:
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
npm run db:push          # ← push a la Supabase COMPARTIDA, ANTES de deployar
npx tsx scripts/backfill-invoice-paytoken.ts          # dry-run
npx tsx scripts/backfill-invoice-paytoken.ts --apply
```

Campos nuevos (todos nullable / con default → sin `--accept-data-loss`):
`Invoice.payToken/paymentProvider/checkoutUrl/checkoutRef`, modelo `Payment`,
`ServicioRecurrente.subProvider/subExternalId/subStatus/subAuthUrl`,
`User.empresaId`, `Role.CLIENTE`.

### 1.2 Variables de entorno (Vercel — proyecto CRM)

| Var | De dónde sale |
|---|---|
| **`PAYMENTS_ORG_IDS`** | **Candado multi-tenant.** El id de la organización Just Create: `cmske462000008ahb29n2427g`. Sólo las orgs de esta lista pueden cobrar online — Abba y cualquier otro tenant quedan afuera aunque activen la facturación automática. Fail-safe: vacío = nadie cobra. |
| `WHOP_API_KEY` | Whop dashboard → Developer → API keys |
| `WHOP_PRODUCT_ID` | Whop → un "product" bajo el cual se crean los planes (`prod_…`) |
| `WHOP_COMPANY_ID` | Whop dashboard → tu company → Settings (`biz_…`) — **obligatorio**, sin esto Whop devuelve 404 |
| `WHOP_WEBHOOK_SECRET` | Whop → Developer → Webhooks (empieza con `ws_…`) |
| `WHOP_SANDBOX` | opcional, `"true"` para pegarle a `sandbox-api.whop.com` (probar sin cobrar de verdad) |
| `MP_ACCESS_TOKEN` | Mercado Pago → Tus integraciones → Credenciales de producción (`APP_USR-…`) |
| `MP_WEBHOOK_SECRET` | Mercado Pago → Webhooks → "Clave secreta" |

> **Nivel 2 (multi-tenant real)** — cuando un 2º cliente quiera cobrar por el
> CRM: convertir esto en un plugin `payments` con credenciales por organización
> (como NISSI carga las de WhatsApp) + webhook ruteado por token de org
> (`/api/webhooks/mercadopago/<token>`). Hasta entonces, `PAYMENTS_ORG_IDS` es
> el candado.

`NEXT_PUBLIC_APP_URL` ya existe = `https://crm.justcreate.com.ar`.

Sin estas vars, cada proveedor queda "no configurado": los webhooks responden
503 y el link de pago devuelve 502. Nada rompe, simplemente no cobra.

### 1.3 Webhooks en cada panel

- **Whop** → `https://crm.justcreate.com.ar/api/webhooks/whop`
  Eventos: `payment.succeeded`, `payment.refunded`/`payment.chargeback`,
  `membership.went_valid`, `membership.cancelled`.
- **Mercado Pago** → `https://crm.justcreate.com.ar/api/webhooks/mercadopago`
  Tópicos: `payment`, `subscription_authorized_payment`, `subscription_preapproval`.

### 1.4 Whop — setup de cuenta

1. Crear la company de Just Create → copiar su id (`biz_…`) a `WHOP_COMPANY_ID`.
2. Crear **un product** (ej. "Servicios Just Create") → copiar su id a `WHOP_PRODUCT_ID`.
   Los planes (uno por factura / uno por abono con débito) los crea el CRM solo,
   con `visibility: hidden`, vía `POST /checkout_configurations` (crea plan +
   checkout en una sola llamada — no son dos pasos separados).
3. Habilitar en el API key los permisos `plan:create`, `checkout_configuration:create`
   (Developer → API keys → editar la key → permisos). Sin esto Whop devuelve
   401 "no tiene permisos"; con la key sin `WHOP_COMPANY_ID` devuelve 404
   confuso ("No such AccessPass found") — los dos ya se corrigieron en el código.

> API REST v1 (`api.whop.com/api/v1`, no v2). Probar primero con
> `WHOP_SANDBOX=true` (pega a `sandbox-api.whop.com`, no cobra de verdad) antes
> de sacarlo a producción.

### 1.5 Just Create como tenant

Editar `scripts/seed-justcreate-billing.ts` (array `CLIENTES`: monto, moneda,
día de vencimiento, email de facturación, CUIT de cada uno) y correr:

```bash
npx tsx scripts/seed-justcreate-billing.ts            # dry-run
npx tsx scripts/seed-justcreate-billing.ts --apply
```

Crea las 4 empresas (`isCliente=true`) + 1 abono cada una + contacto de
facturación, y activa el plugin `invoice-automation` para la org Just Create.

### 1.6 Cron nuevo

`vercel.json` agrega `payment-reminders` (diario 14:00 UTC). Se despliega solo
con el deploy.

---

## 2. Cómo se usa

### Facturas puntuales

1. El 1° de cada mes el cron `invoice-automation` genera las facturas PENDING
   (ya existía). Cada una nace con `payToken`.
2. En **Facturación**: revisás y enviás la factura por mail (botón de siempre).
   El mail ahora incluye **"Pagar ahora"** → `crm.justcreate.com.ar/pagar/<token>`.
   O copiás el link con la acción **"Link de pago"** de la fila.
3. El cliente abre el link (sin login), toca Pagar → checkout hosteado de
   Whop (USD) o Mercado Pago (ARS).
4. El webhook del proveedor marca la factura **PAID**, deja nota en la empresa
   y te avisa por mail. (El redirect del browser NO es lo que confirma el pago.)
5. Si sigue impaga: `payment-reminders` reenvía el link a los **3 y 7 días**
   del vencimiento (sólo a facturas ya enviadas). **Opt-in por organización**:
   sólo corre si el plugin `invoice-automation` tiene `remindersEnabled="true"`
   en su config — el `seed-justcreate-billing.ts` lo deja seteado para Just
   Create; ninguna otra organización (Abba, etc.) manda recordatorios sin
   pedirlo.

Transferencia (Abba): mismo mail; cuando llega la plata, **"Marcar pagada"** a
mano — eso ahora también deja un `Payment` (provider `MANUAL`).

### Débito automático

En la ficha de la Empresa → cada abono tiene **"Activar débito automático"**:

1. Genera el link de autorización (Whop plan renovable / MP preapproval).
2. Se lo mandás al cliente **una vez**. Autoriza el débito.
3. El proveedor cobra solo cada ciclo → el webhook crea la factura del mes ya
   PAID. El cron mensual **saltea** ese abono.
4. Para cortarlo: "cancelar" en el mismo control (vuelve a facturarse normal).

### Portal de clientes

- En la ficha de la Empresa (si es cliente) → **"Portal de clientes" → "Dar acceso"**:
  cargás un email, se crea el usuario y le llega el link.
- El cliente entra en `crm.justcreate.com.ar/portal` con **magic link** (sin
  contraseña). Ve: estado de cuenta + servicios, sus facturas (con botón Pagar),
  y soporte (abre/responde tickets — caen en Tickets del CRM).
- En `justcreate.com.ar`: agregar un botón "Acceso clientes" → esa URL.

---

## 3. Seguridad (resumen — detalle en el plan)

- **Rol `CLIENTE` excluido de `getCurrentUser()`** igual que `GREMIO`: no puede
  pegarle a las ~109 APIs internas. Sólo lo sirve `/api/portal/*` con chequeo
  explícito y scope `{ organizationId, empresaId }` de `getPortalUser()`.
- **Monto del checkout siempre server-side** desde `Invoice.amount`. MP además
  re-verifica `transaction_amount`/`currency_id` contra la factura; si no
  coincide → `Payment` REJECTED, factura intacta, alerta al staff.
- **Firma de webhook obligatoria y fail-closed** (Whop HMAC-SHA256 sobre
  `{id}.{ts}.{body}`; MP `x-signature` + fetch a la API de MP como fuente de
  verdad). Body leído crudo antes de parsear.
- **Idempotencia**: `Payment @@unique([provider, externalId])`; PENDING→PAID
  una sola vez.
- `payToken` = `uuid()` (122 bits). `/pagar/<token>` sólo muestra monto +
  concepto + branding. Rate-limit por IP.
- Magic link con `shouldCreateUser: false`; el callback verifica `role/status/
  empresaId` antes de dejar entrar.

---

## 4. Verificación E2E (sandbox)

1. `GET /api/cron/invoice-automation?dryRun=1` con `Authorization: Bearer $CRON_SECRET`
   → lista las 4 empresas.
2. Factura USD → enviar → abrir `/pagar/<token>` en incógnito → pagar con
   tarjeta de test Whop → factura pasa a PAID, `Payment` creado, nota en empresa.
   Reenviar el mismo webhook → no duplica.
3. Factura ARS con MP: ídem. Probar monto adulterado → NO pasa a PAID.
4. `dueDate` a -4 días → correr `payment-reminders` → 1 mail; correr de nuevo el
   mismo día → nada (CronRun).
5. Abono con débito → autorizar en sandbox → `payment.succeeded` recurrente →
   factura del mes creada PAID; `subStatus` → ACTIVO; el cron mensual lo saltea.
6. Portal: alta de usuario CLIENTE → magic link → sólo ve lo de su empresa.
   Con ese token: `GET /api/invoices` y `/api/empresas` → 401/403.

---

## 5. Pendiente / fuera de v1

- **Documentos en el portal**: `Document` linkea a `Client` (legacy), no a
  `Empresa` — falta esa relación para poder mostrarlos sin over-share.
- Avisos por WhatsApp (hoy sólo email).
- Factura fiscal AFIP: manual (contador). El CRM sólo concilia el pago.
- Multi-tenant de pagos: hoy un solo juego de credenciales (Just Create) por
  env var. Para abrirlo a otros tenants → mover a un plugin `payments` con
  `PluginConfig` (y cifrar, hoy guarda secretos en texto plano).
