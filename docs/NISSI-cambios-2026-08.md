# NISSI — cambios de agosto 2026 (Gemini + inbox + catálogo)

Documento de referencia de todo lo que se hizo en esta tanda. El **paso a paso
de puesta en marcha** está aparte, en [`NISSI-deploy-gemini.md`](./NISSI-deploy-gemini.md).

Rama: `feature/nissi-gemini-inbox` (repo `crm`), commits `376b741 … ca2bfdd`.
**Sin mergear ni pushear.** `npm run build` + `tsc` + `prisma validate` limpios.

---

## 1. Por qué

Abba quería tres cosas concretas sobre NISSI (el bot de WhatsApp con IA):

1. **Que sea barato.** El motor corría sobre Claude (Anthropic) y a volumen real
   iba a costar USD 30–50/mes. Se pidió migrar a **Google Gemini** (~10x más
   barato por token) y optimizar el gasto.
2. **Que el equipo pueda ver y responder las conversaciones desde el CRM**, sin
   tener que darle a cada persona acceso a las herramientas de Meta.
3. **Que asesore sobre producto** (explicar líneas de cámaras/alarmas) como lo
   hace un vendedor humano — pero **sin cotizar** (Abba pospuso la cotización
   automática).

Estado previo: NISSI estaba construido y verificado contra la base, pero
**nunca se había probado E2E** con WhatsApp real. Las conversaciones no se veían
en ninguna parte del CRM.

---

## 2. Qué cambió

### Fase 1 — Migración a Google Gemini

- **Motor** (`src/lib/whatsapp-bot/engine.ts`): reescrito de `@anthropic-ai/sdk`
  a `@google/genai`. Modelo por defecto `gemini-2.5-flash` (configurable a
  `gemini-2.5-flash-lite` desde el plugin, sin deploy). Function-calling manual,
  `thinkingBudget: 0`, safety en `BLOCK_ONLY_HIGH` (el vocabulario de alarmas
  disparaba falsos positivos de `DANGEROUS_CONTENT` con umbrales más bajos).
  `@anthropic-ai/sdk` eliminado del `package.json`.
- **Config del plugin** (`src/plugins/definitions.ts`, `src/lib/whatsapp-bot/config.ts`):
  el campo `anthropicApiKey` pasó a `geminiApiKey`, más un `geminiModel`
  opcional. El `ConfigModal` es schema-driven, así que al re-guardar el plugin
  el campo viejo se borra solo.
- **Optimización de costo**:
  - Caché **implícito** de Gemini 2.5 (el prefijo systemInstruction + tools se
    repite en todas las conversaciones de Abba → descuento automático).
  - **Debounce**: los clientes de WhatsApp mandan varios mensajes cortos
    seguidos ("Gral pico" / "Ranqueles 7" / "que la instalen"). Se espera 2,5 s
    y se procesan juntos en una sola llamada al modelo.
  - `MAX_TOOL_ROUNDS` bajó de 6 a 4.
  - La confirmación de "ya te derivé" es texto fijo, no una llamada extra al
    modelo.
  - `system-prompt.ts` recortado ~30%.
  - `maxDuration = 60` en el webhook (el sleep del debounce + Gemini + tools no
    entra en el default de ~10 s de Vercel).

### Fase 2 — Inbox de WhatsApp en el CRM

- **Página** `src/app/(dashboard)/conversaciones/page.tsx` (ítem "WhatsApp" en el
  menú, sección Comunicación — sólo aparece si el plugin está activo). Dos
  vistas: **Bandeja** (master-detail: lista + hilo + caja de respuesta) y
  **Estadísticas** (ver más abajo). Polling con TanStack Query (15 s la lista,
  8 s el hilo).
- **Mobile**: el hilo abre como pantalla completa (`fixed inset-0`), no queda
  tapado por la barra rápida; safe-area arriba y abajo; envío optimista (el
  mensaje aparece al instante con un reloj y después el tick); tap targets
  grandes.
- **Entrega de mensajes**: cada mensaje saliente guarda el id de Meta y su
  estado (`WhatsAppMessage.deliveryStatus`: sent/delivered/read/failed). El
  webhook procesa el array `statuses` de Meta. En el hilo se ven los ticks
  (✓ / ✓✓ / ✓✓ azul / ⚠ si falló). El cliente recibe el doble check azul
  cuando su mensaje se procesa (`markWhatsAppMessageRead`).
- **Toma humana**: cuando un humano responde desde el inbox, la conversación
  queda "tomada" (`WhatsAppConversation.humanTakeoverAt`). Mientras está tomada,
  **NISSI no contesta ese hilo** — el gate está en `engine.ts` antes de invocar
  al modelo. Se libera con el botón "Devolver a NISSI" o sola tras 24 h sin
  actividad humana.
- **API** `src/app/api/conversaciones/`:
  - `GET /` — lista (filtros: todas / NISSI / con humano / derivadas / cerradas)
  - `GET /[id]` — hilo + estado de la ventana de 24 h + deal/ticket/contacto
    vinculados
  - `POST /[id]/reply` — responder (envía por la Cloud API, guarda el mensaje
    con `senderUserId`, toma la conversación)
  - `POST /[id]/takeover` — tomar / devolver a NISSI
  - `POST /[id]/read` — marcar leída
- **Badge de no-leídos** en el sidebar (`/api/notifications/counts` → `whatsapp`).
  Marcador de lectura a **nivel organización** (bandeja compartida, equipo chico).
- **Ventana de 24 h de Meta**: fuera de ella no se puede mandar texto libre. El
  inbox lo detecta y deshabilita la caja de respuesta con un aviso.

### Fase 3 — Conocimiento de producto ("educar sin cotizar")

- **Búsqueda de catálogo compartida** (`src/lib/catalogo-search.ts`): se extrajo
  la lógica de filtros de `GET /api/catalogo/products` a `searchCatalogo()`,
  reutilizada por la ruta y por el bot. El wrapper `buscarCatalogoParaBot()`
  hace el `select` **sin `price` / `precioGremio` / `costo`** — NISSI nunca ve
  precios.
- **Tool `buscar_catalogo`** (`src/lib/whatsapp-bot/tools.ts`): NISSI puede
  consultar el catálogo para confirmar disponibilidad y explicar líneas. No
  deriva ni manda mail — es sólo lectura. Reintenta la búsqueda sin acentos /
  por palabra clave si la primera no da resultados (Postgres `ILIKE` no pliega
  acentos y el catálogo los tiene: "CÁMARA").
- **Sección de producto en el prompt** (`src/lib/whatsapp-bot/system-prompt.ts`):
  analógica vs IP, IP con NVR vs Full P2P, PT giratoria, funciones de IA, guía
  por escenario (interior/exterior/casa/comercio/campo), distancia al grabador.
  Regla dura que se mantiene: **nunca un precio, ni estimado — después de
  orientar, deriva con `create_sales_lead`**.
  ⚠️ **Es un BORRADOR** basado en las 2 conversaciones reales que pasó Juan.
  Abba tiene que confirmar marcas, líneas y disponibilidad reales.

### Estadísticas del inbox

Vista "Estadísticas" en `/conversaciones` (componente lazy — recharts no entra
al bundle de la bandeja). `GET /api/conversaciones/stats?days=30`:
- **Ahora mismo**: conversaciones totales, sin leer, las que maneja NISSI, con
  un humano.
- **Últimos N días** (7/30/90): conversaciones nuevas, % que resolvió NISSI
  sola, derivadas a un área, tomadas por un humano.
- **Mensajes**: del cliente / de NISSI / de humanos, promedio por conversación,
  fallidos.
- **Serie diaria** de 14 días (mini gráfico de barras).
- **Derivaciones por área** (Ventas / Soporte / Administración) y
  **oportunidades creadas por NISSI** por tipo (compra / instalación / gremio /
  asesor).

### Además (cabos sueltos que se cerraron de paso)

- NISSI ahora **linkea el `DirectorioContacto`** también en tickets de
  soporte/facturación (antes sólo en ventas). Nuevo campo `Ticket.contactoId`.
- Al derivar, NISSI **pega el transcript completo** de la charla como `DealNota`
  tipo `CHAT` (ventas) o `TicketMessage` interno (soporte/facturación) — así el
  humano que la toma ve todo el contexto sin abrir el inbox.
- Se guarda el **tipo de venta** (`Deal.leadReason`: compra / instalacion_nueva
  / gremio / asesor), visible como un chip en el detalle del Pipeline.

---

## 3. Cambios de schema (`prisma db push`, aditivos + nullable)

| Modelo | Campos nuevos |
|---|---|
| `WhatsAppConversation` | `humanTakeoverAt`, `assignedUserId` (+ rel), `lastInboundAt`, `lastReadAt`, `contextResetAt`, índices `[organizationId, lastMessageAt]` y `[organizationId, createdAt]` |
| `WhatsAppMessage` | `processedAt`, `senderUserId` (+ rel), `deliveryStatus`, `deliveryError`, `organizationId` (denormalizado, para las stats), índices `[senderUserId]` y `[organizationId, createdAt]` |
| `Ticket` | `contactoId` (+ rel a `DirectorioContacto`), índice |
| `Deal` | `leadReason` |
| `User` | back-relations `whatsAppConvsAssigned`, `whatsAppMessagesSent` |

Ninguno borra ni cambia datos existentes. **Requiere un backfill** de
`lastInboundAt` para las conversaciones que ya existían (ver runbook).

---

## 4. Decisiones de diseño

| Decisión | Por qué |
|---|---|
| **Gemini 2.5 Flash** (no Flash-Lite por defecto) | Mejor confiabilidad de tool-calling con clientes reales; Flash-Lite queda como opción de un click si el costo lo amerita. |
| **`humanTakeoverAt` como campo, no un valor del enum de status** | La toma humana es ortogonal al `status`: una charla `ACTIVE` o `HANDED_OFF` puede estar tomada por un humano igual. Y el timestamp sirve para la auto-liberación. |
| **Marcador de lectura a nivel org** (no por usuario) | Bandeja compartida de un equipo chico. Migrable a por-usuario con una tabla `WhatsAppConversationRead` si hace falta. |
| **Match de org por `phoneNumberId` crudo** (no la config validada) | Si al plugin le falta la key de Gemini, igual sabemos a qué org pertenece el mensaje → se guarda y aparece en el inbox en vez de perderse. |
| **Caché implícito** (no explícito) | El prefijo estático es chico (~1,5 KB); el caché explícito agrega costo de almacenamiento y código de ciclo de vida para poca ganancia. Se puede sumar si `cachedContentTokenCount` muestra baja tasa de acierto. |
| **Debounce por orden de `createdAt`** (no un lock) | Más simple; la idempotencia por `waMessageId` ya evita el doble insert. |
| **NISSI no cierra conversaciones ni mueve etapas del Pipeline** | Evita falsos positivos (marcar una venta ganada que no se concretó). NISSI califica y deriva; el humano maneja el kanban. |
| **La sección de producto no inventa specs ni stock** | Se le dice explícitamente "no inventes; si no estás segura, derivá". El catálogo real lo confirma Abba. |

---

## 5. Revisión de bugs

Se corrieron **dos pasadas** de review sobre el diff completo. **Ningún blocker
sin resolver.** Todos los hallazgos accionables se corrigieron (commits
`ff93933`, `e96efba`, `ca2bfdd` y los de la segunda pasada).

### Primera pasada — 1 blocker + 3 bugs + 6 cabos sueltos

| Hallazgo | Resolución |
|---|---|
| **Blocker**: durante la ventana deploy→re-guardar la config, los mensajes entrantes se perdían sin rastro | Match de org por `phoneNumberId` crudo → el mensaje se guarda y aparece en el inbox; un humano responde a mano. `engine.ts` acepta `botConfig: null`. |
| **Bug**: la auto-liberación de 24 h contaba desde la PRIMERA toma humana, no la última | `humanTakeoverAt` se refresca en cada respuesta humana (`reply/route.ts`). |
| **Bug**: un `categoryId` viejo/stale de la UI devolvía el catálogo entero | `resolveCategoriaFilter` con flag `exactId`: si no matchea, filtra por ese id igual (0 resultados). |
| **Loose end**: `buscar_catalogo` fallaba seguido por acentos (Postgres ILIKE) | Reintentos sin acentos / por palabra; la descripción del tool pide keywords sin tildes. |
| **Loose end**: `lastInboundAt` no backfilleado → conversaciones viejas "fuera de ventana" y no respondibles | `UPDATE` de backfill en el runbook. |
| **Loose end**: el ítem "WhatsApp" del menú se veía para todos los tenants | `requiresPlugin: 'whatsapp-ai-bot'` — sólo si el plugin está activo. |
| **Loose end**: el badge de WhatsApp se calculaba para todos los roles | Gateado a SELLER+. |
| **Nits**: debounce sin tiebreaker; `res.text` spammeaba warnings; preámbulos usados como respuesta final; `MALFORMED_FUNCTION_CALL` no manejado | Todos corregidos en `engine.ts`. |

### Segunda pasada (sobre el estado ya corregido) — 0 blockers, 2 bugs, varios cabos sueltos

| Hallazgo | Resolución |
|---|---|
| **Bug**: `MALFORMED_FUNCTION_CALL` de Gemini se trataba como bloqueo fatal (mail "filtro de seguridad" + corte) | Sacado del set de bloqueos — ahora cae al reintento sin herramientas (el modelo se autocorrige). |
| **Bug**: error genérico de la API de Gemini y `MAX_TOKENS` no avisaban a un humano | Un único `notifyHuman` al final si NISSI no pudo responder y no derivó (con el motivo). `MAX_OUTPUT_TOKENS` subió 800 → 1200. |
| **Loose end**: `buscar_catalogo` hacía hasta ~13 queries a Supabase por llamada | Queries deduplicadas, la categoría se resuelve una sola vez. Guard de query < 2 caracteres. |
| **Loose end**: al reabrir una conversación se le reenviaba a Gemini el transcript viejo entero | Campo `contextResetAt` — el engine sólo manda los mensajes desde el reinicio. |
| **Loose end**: el guard de "plugin sin config" corría DESPUÉS de mutar el estado de la conversación | Movido antes — sin config, sólo se guarda el mensaje, no se toca nada más. |
| **Loose end**: el ítem del sidebar fallaba "cerrado" ante un error de red (inconsistente con el resto) | `hasPlugin` ahora falla "abierto"; reusa la query `['plugins']` cacheada. |
| **Nits**: `extractText` no saltaba parts de "thought"; `?c=` inválido dejaba un skeleton eterno; el modal del Pipeline no manejaba el 404 | Todos corregidos. |

**No corregido (documentado, es preexistente)**: si el "Email de Ventas" del
plugin no matchea un usuario del CRM, el Deal de NISSI queda con dueño
SUPER_ADMIN y un vendedor con rol SELLER **no lo ve en su Pipeline**; el link
desde el inbox le muestra "no encontrada o sin acceso" (antes: skeleton
infinito). Solución: cargar bien ese email. Es el modelo de permisos que ya
tenía el CRM.

---

## 6. Costo

Estimación a ~25 conversaciones/día (750/mes), con las optimizaciones aplicadas:

| | USD/mes aprox |
|---|---|
| Gemini 2.5 Flash | ~2 a 6 |
| Gemini 2.5 Flash-Lite | ~1 a 3 |

Una conversación entera ≈ **2 a 8 centavos de dólar**. Es prepago (se carga
saldo en Google AI Studio, con tope mensual). Las pruebas cuestan centavos.

Meta / WhatsApp: **$0** — NISSI sólo responde dentro de la ventana de 24 h con
mensajes normales (nunca plantillas de marketing). El número de prueba también
es gratis.

---

## 7. Limitaciones conocidas

- **Imágenes**: los clientes que mandan fotos/capturas siguen viéndose sólo como
  "[el cliente envió una imagen…]". El contenido real no se guarda ni se muestra
  (fuera de alcance de esta entrega).
- **Re-enganche tras 24 h**: si un lead se enfría, NISSI no puede volver a
  escribirle sin una plantilla de Meta aprobada (no hay ninguna).
- **Multi-mensaje en un solo webhook POST**: si Meta agrupa varios mensajes en un
  POST (poco común), el debounce puede mandar una respuesta por mensaje en vez de
  una sola. No se pierde nada, las respuestas quedan en contexto.
- **Prompt hardcodeado a Abba / seguridad electrónica**: si otra empresa activa
  el plugin, `system-prompt.ts` es el primer archivo a revisar.

---

## 8. Qué falta (sólo Juan)

Todo en [`NISSI-deploy-gemini.md`](./NISSI-deploy-gemini.md): `prisma db push` +
backfill, env vars en Vercel, registrar el webhook en Meta, API key de Gemini
cargada en el plugin, prueba E2E con el número de prueba, y después el número
real de Abba + token permanente + app en modo Live.
