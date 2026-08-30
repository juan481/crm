# NISSI — puesta en marcha (Gemini + inbox)

Rama: `feature/nissi-gemini-inbox`. Nada está pusheado ni mergeado. Todo el
código compila (`npm run build` + `npx tsc --noEmit` limpios). Falta lo que
**sólo puede hacer Juan** (config en servicios externos + la prueba real).

---

## 0. Antes de mergear — `prisma db push` contra Supabase (PROD)

Los cambios de schema son **todos aditivos + nullable** (columnas nuevas +
1 índice), no borran ni cambian nada existente. Aun así, es la DB de producción:

1. **Snapshot de Supabase** (Dashboard → Database → Backups, o PITR).
2. En una ventana de bajo tráfico:
   ```
   cd crm
   git checkout feature/nissi-gemini-inbox
   npm ci
   npm run db:push
   ```
   `db:push` = `prisma db push`. Usa `DIRECT_URL` del `.env`.
3. Verificar que no pidió `--accept-data-loss` (no debería). Si lo pide, **frenar**
   y revisar el diff.

Campos nuevos: `WhatsAppConversation` (`humanTakeoverAt`, `assignedUserId`,
`lastInboundAt`, `lastReadAt`), `WhatsAppMessage` (`processedAt`, `senderUserId`),
`Ticket.contactoId`, `Deal.leadReason`.

---

## 1. Variables de entorno en Vercel

Vercel → proyecto del CRM → Settings → Environment Variables (Production +
Preview + Development), y **redeploy** después:

| Variable | Valor |
|---|---|
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | un string largo random inventado por vos (ej. `nissi-abba-9f3k2p8x`). Se pega igual en Meta (paso 3). |
| `WHATSAPP_APP_SECRET` | *(opcional, recomendado)* App secret de la app de Meta → Meta App Dashboard → Configuración → Básica → Mostrar. |

---

## 2. API Key de Google Gemini

1. Entrar a **https://aistudio.google.com/apikey** (Google AI Studio) con la
   cuenta de Google de Just Create / Abba.
2. **Create API key** → copiar (`AIza...`).
3. Opcional: en la consola de Google Cloud del proyecto asociado, poné un
   **límite de gasto mensual** para que nunca se dispare.
4. Costo esperado: Gemini 2.5 Flash ≈ USD 0.15–0.30 / millón de tokens de
   entrada, ≈ 1.25–2.50 / millón de salida. Una conversación entera ≈ centavos.
   Si querés lo más barato, después se puede cambiar el modelo a
   `gemini-2.5-flash-lite` desde el plugin (campo "Modelo de Gemini") sin deploy.

---

## 3. Registrar el webhook en Meta

Meta App Dashboard → tu app → **WhatsApp → Configuración → Webhook → Editar**:

- **Callback URL**: `https://crm.justcreate.com/api/webhooks/whatsapp`
- **Verify token**: el mismo string de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- **Verificar y guardar** → tiene que dar OK.
- **Campos del webhook → Suscribir `messages`** (sólo ese).

Chequeo rápido:
```
curl "https://crm.justcreate.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<TU_TOKEN>&hub.challenge=123"
```
Tiene que responder `123`.

---

## 4. Número de prueba + configurar el plugin

Meta → **WhatsApp → Configuración de la API**:
- "Generar identificador" → token temporal de 24hs. Copialo.
- Agregar hasta 5 números destinatarios de prueba (los tuyos).
- Phone Number ID de prueba: `1200873799787152`.

CRM → **Configuración → Plugins → NISSI** → activar → **Configurar**:

| Campo | Qué poner |
|---|---|
| Token permanente de WhatsApp Cloud API | el token de 24hs (para probar) |
| Phone Number ID (Meta) | `1200873799787152` |
| **API Key de Google Gemini** | la key `AIza...` del paso 2 |
| Modelo de Gemini | dejar vacío (usa `gemini-2.5-flash`) |
| Horario / Dirección / Cobertura / Métodos de pago | datos reales de Abba |
| Email de Ventas | mail de Oscar Ale o Mauro Dómina (**usuario del CRM**) |
| Email de Administración | mail de Norma |

> ⚠️ **Migración de la key**: el plugin de Abba tenía cargada la key vieja de
> Anthropic en un campo que ya no existe. Hasta que guardes la nueva config con
> la **API Key de Gemini**, NISSI no responde nada (el inbox del CRM sí funciona
> para responder a mano). Al guardar, el campo viejo se borra solo.

---

## 5. Prueba E2E (con el número de prueba)

Desde un WhatsApp registrado, escribiéndole a `+1 555 675 6899`:

1. **"hola"** → NISSI responde en segundos. Si no → Vercel → Logs, buscá
   `[NISSI ENGINE]` / `[WHATSAPP WEBHOOK]`.
2. **Venta**: "quiero cámaras para mi casa" → seguí el filtro → datos ficticios
   → NISSI deriva. En el CRM: Pipeline → Oportunidad `LEAD`, contacto creado y
   linkeado, chip "WhatsApp · Compra de equipos", nota tipo CHAT con el
   transcript, mail a Ventas.
3. **Producto**: "¿tienen cámaras giratorias para exterior?" → NISSI usa el
   catálogo, explica IP PT / Full P2P, **sin precio**, sigue calificando.
4. **Soporte urgente**: "mi alarma no reporta a la central" → filtro técnico →
   Ticket SOPORTE prioridad ALTA, asignado a un técnico fichado, con contacto
   linkeado y transcript interno.
5. **Facturación**: "necesito la factura del mes" → Ticket FACTURACION.
6. **Debounce**: mandá 3 mensajes cortos seguidos → UNA sola respuesta.
7. **Inbox**: entrá a **Conversaciones** en el CRM (menú, sección Comunicación).
   Abrí la charla, escribí una respuesta → llega al WhatsApp; la conversación
   pasa a "Con humano"; el siguiente mensaje del cliente **NISSI no lo contesta**
   (queda sin leer en el inbox). "Devolver a NISSI" → vuelve a contestar sola.
8. **Fuera de 24hs**: si el cliente no escribe hace más de un día, la caja de
   respuesta del inbox avisa y no deja mandar.
9. **Costo**: revisá el uso en Google AI Studio → centavos.

---

## 6. Pasar a producción

1. Meta → agregar y verificar el **número real de Abba** (dedicado — ese número
   pierde la app de WhatsApp normal). Cargar display name (lo aprueba Meta).
2. **Token permanente**: Meta Business Settings → Usuarios del sistema → nuevo
   (Admin) → agregar la app → token con `whatsapp_business_messaging` +
   `whatsapp_business_management`, sin caducidad.
3. CRM → Plugins → NISSI → reemplazar el token de 24hs por el permanente y el
   Phone Number ID de prueba por el del número real.
4. App de Meta a modo **Live** (requiere Business Verification — tarda).
5. Mergear `feature/nissi-gemini-inbox` a `main` → Vercel deploya.
6. Repetir los escenarios del paso 5 con el número real.

---

## Notas

- **Permisos del inbox**: SUPER_ADMIN / ADMIN / SELLER. Para sumar TECHNICIAN:
  agregar `'TECHNICIAN'` a `defaultRoles` de `conversaciones` en
  `src/lib/modules.ts` y `/conversaciones` a `ROLE_ALLOWED_PREFIXES.TECHNICIAN`
  en `src/components/layout/app-shell.tsx`.
- **Imágenes**: los clientes que mandan fotos/capturas siguen viéndose en el
  inbox sólo como "[el cliente envió una imagen…]" — el contenido real no se
  guarda (fuera de alcance de esta entrega).
- **Sección de producto del prompt** (`system-prompt.ts`, "# Cómo asesorar
  sobre producto"): es un **borrador** basado en las 2 conversaciones reales de
  Abba. Abba tiene que confirmar marcas/líneas/stock antes de darlo por bueno.
- **`Deal.currency` default `"USD"`**: hay deals viejos que pueden estar en USD
  por error (deberían ser ARS). El "Valor esperado" del Pipeline los muestra
  aparte, no es un bug de conversión. Ver `scripts/audit-deal-currencies.ts`.
