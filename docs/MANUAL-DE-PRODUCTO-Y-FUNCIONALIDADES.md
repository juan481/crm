# JustCRM · Manual Completo de Producto, Funcionalidades y Arquitectura

> **Documento Oficial de Producto & Capacidades del Sistema**  
> *Especializado en Empresas de Seguridad Electrónica, Integradores Tecnológicos, Empresas de Monitoreo e IoT.*  
> **Versión:** 3.5 Enterprise  
> **Última actualización:** Septiembre 2026  

---

## 1. Resumen Ejecutivo y Misión de JustCRM

**JustCRM** es la plataforma integral de gestión comercial, operativa y administrativa diseñada desde cero para resolver las fricciones operativas que sufren las **empresas de seguridad electrónica, monitoreo de alarmas, videovigilancia (CCTV), control de accesos, redes e Internet de las Cosas (IoT)**.

A diferencia de los CRMs genéricos del mercado (que solo gestionan contactos y pipelines abstractos), JustCRM unifica en un único ecosistema:
1. **La venta consultiva técnica** (cotizador de kits de cámaras, alarmas, sensores, cables, servicios mensuales y abonos recurrentes).
2. **El canal de WhatsApp automatizado con Inteligencia Artificial (NISSI)** que dialoga técnicamente con clientes, responde consultas sin alucinar y deriva con transcript completo a Ventas, Soporte o Administración.
3. **El catálogo de gremio y mayorista** con distinción automática de precios Gremio (para instaladores/integradores) y Público Final.
4. **La gestión real de depósito y stock** (conteo físico inicial sin necesidad de factura previa, remitos y entregas de mercadería vinculadas a cotizaciones ganadas).
5. **La administración y facturación legal (ARCA / AFIP)** con discriminación exacta de IVA, multimoneda en tiempo real (USD y ARS) y portal de autogestión para clientes.

---

## 2. Radiografía por Roles y Casos de Uso (Personas)

El sistema cuenta con un motor granular de roles (`SUPER_ADMIN`, `ADMIN`, `SELLER`, `SUPPORT`, `ADMINISTRATIVE`) que adapta la interfaz y el nivel de acceso a cada actor de la empresa:

```
                  ┌────────────────────────────────────────┐
                  │          SUPER_ADMIN / DIRECTOR        │
                  │  Visión global, KPIs, Márgenes, MRR    │
                  └──────────────────┬─────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ GERENTE DE VENTAS│       │  ADMINISTRACIÓN  │       │ SOPORTE TÉCNICO  │
│ Supervisión,     │       │ Facturas AFIP,   │       │ Postventa, SLAs, │
│ Pipeline, SLAs,  │       │ Stock, Remitos,  │       │ Tickets, Guardias│
│ Desempeño Seller │       │ Cobranzas, Caja  │       │ de Monitoreo     │
└────────┬─────────┘       └──────────────────┘       └──────────────────┘
         │
         ▼
┌──────────────────┐
│    VENDEDOR      │
│ Cotizador Flash, │
│ WhatsApp Inbox,  │
│ Mis Oportunidades│
└──────────────────┘
```

### A. Para Empresas de Seguridad Electrónica e IoT
* **Cotizaciones complejas en segundos:** Armado de presupuestos con cámaras domo, bullet, grabadores NVR/DVR, fuentes, discos rígidos y mano de obra sin olvidar componentes críticos.
* **Manejo de Kits Inteligentes:** Un kit (ej. "Kit 4 Cámaras IP AcuSense") se vende como un único ítem con precio cerrado, pero el sistema sabe qué componentes individuales descuentan del stock al momento de la instalación.
* **Monitoreo y Abonos Recurrentes:** Módulo nativo para liquidar mensualmente los abonos de monitoreo 24/7, soporte técnico y hosting en la nube (MRR).

### B. Para los Vendedores (Fuerza Comercial)
* **Cotizador Instantáneo:** Agrega productos con un clic, aplica precios según cliente (Público o Gremio), conmuta entre Dólares y Pesos al tipo de cambio del día y genera un PDF profesional de calidad de agencia.
* **Envío Directo por Correo:** El PDF se adjunta y envía con un clic al destinatario desde el servidor SMTP propio de la empresa o Amazon SES.
* **Inbox de WhatsApp Centralizado:** Chatea directamente con los clientes desde la web sin depender del celular del vendedor, con marcas de entrega (✓✓ azul) y takeover instantáneo del bot.
* **Seguimiento sin olvidos:** Creación automática de deals en el Pipeline cada vez que se emite un presupuesto o un lead calificado entra por WhatsApp.

### C. Para los Gerentes de Ventas y Directores Comerciales
* **Pipeline Visual Drag & Drop:** Visualización del embudo de ventas dividido por etapas (Nuevo, Contactado, Cotización Enviada, En Negociación, Ganado, Perdido).
* **Control de Asignación:** Posibilidad de que los vendedores solo vean sus propios tratos, mientras los gerentes tienen la panorámica global de todo el equipo.
* **Estadísticas de Conversión y Bot:** Tablero para medir cuántos leads entran por WhatsApp, cuántos resolvió la IA sola, cuántos se derivaron a cotizaciones y cuánto tiempo tardan los vendedores en cerrar.
* **Historial Inmutable de Cotizaciones:** Auditoría de cada cotización emitida, con versión congelada de precios, descuentos y términos de validez.

### D. Para el Área Administrativa y Finanzas
* **Facturación Electrónica Nativa (ARCA / AFIP):** Emisión directa de Facturas A, B, C y Notas de Crédito con obtención de CAE y código de barras.
* **Conversión 1-Clic de Presupuesto a Factura:** No hay que volver a tipear ítems; una cotización aprobada genera su correspondiente comprobante contable y remito de entrega.
* **Gestión de Stock Flexible:**
  * **Conteo Inicial sin Factura:** Carga ágil de inventario físico existente en depósito sin obligar a registrar facturas de compra anteriores.
  * **Remitos de Entrega:** Cada venta reserva stock y emite una orden de entrega física para el pañol/depósito.
  * **Alertas de Stock Crítico:** Indicadores automáticos cuando un producto cae por debajo de su umbral mínimo.
* **Portal de Clientes Autogestionable:** Los clientes pueden ingresar a su propio portal seguro para descargar sus facturas, ver presupuestos pendientes y pagar sus abonos.

---

## 3. Desglose Módulo por Módulo

### MÓDULO 1: Bot de WhatsApp con IA (NISSI) & Bandeja Omnicanal

El cerebro de atención automática del CRM se llama **NISSI**, un agente de inteligencia artificial entrenado para el sector de seguridad:

1. **Motor Gemini 2.5 Flash:**
   * Respuestas ultra rápidas (latencia reducida a menos de 2 segundos).
   * Costos operativos mínimos (~10x más económico que modelos tradicionales).
   * Filtros de seguridad calibrados para terminología de seguridad ("disparo de alarma", "detección de intrusión", "corte de línea").
2. **Debounce Inteligente:**
   * Agrupa los mensajes consecutivos que los clientes suelen enviar en WhatsApp ("Hola", "Quería consultar", "¿Tienen cámaras?") y los procesa en un único contexto para no saturar al usuario ni gastar llamadas innecesarias.
3. **Consulta de Catálogo en Vivo ("Educar sin Precios"):**
   * El bot consulta la base de datos de productos para saber si hay stock o qué características tiene una cámara (visión nocturna, resolución 2MP/4MP, AcuSense, alcance infrarrojo).
   * **Regla estricta:** El bot jamás inventa un precio. Cuando el cliente demuestra interés de compra, recolecta datos y deriva a un vendedor.
4. **Derivación Automática con Transcript Completo:**
   * **A Ventas:** Crea una oportunidad (`Deal`) en el Pipeline en la etapa correspondiente con el motivo de contacto (`leadReason`: compra, nueva instalación, integrador gremio) e inserta el chat completo como nota.
   * **A Soporte:** Si el cliente reporta una falla ("mi cámara no transmite", "la sirena suena sola"), abre un `Ticket` de soporte asignando prioridad alta y vinculando su contacto.
   * **A Administración:** Deriva consultas sobre facturas o pagos.
5. **Inbox de WhatsApp Humano (Human Takeover):**
   * Bandeja compartida para que el equipo responda en vivo desde el CRM.
   * Cuando un operador responde, NISSI se pausa automáticamente para esa conversación.
   * Se puede devolver el control al bot con un botón o se reactiva automáticamente tras 24 horas de inactividad humana.
   * Soporte total para la ventana de 24 horas de WhatsApp Cloud API oficial de Meta.

---

### MÓDULO 2: Cotizador Inteligente y Generador de PDFs White-Clean

El generador de presupuestos es una de las herramientas más potentes del CRM:

1. **Diseño "White-Clean" de Alta Gama:**
   * Encabezado blanco pulido con línea de acento inferior en el color institucional de la empresa.
   * **Compatibilidad total con logos:** Los logos con fondo blanco o transparente lucen perfectos, eliminando recuadros antiestéticos.
   * Formato enmarcado redondeado ("Card Style") con líneas divisorias elegantes entre ítems.
2. **Identificación Técnica Exacta:**
   * Inclusión automática del código de producto **[SKU / MPN]** antes del nombre.
   * Muestra de la **descripción técnica** del producto con salto de línea automático multilínea sin desbordar los precios ni pisar las etiquetas de tipo.
   * Distinción clara de ítems mediante insignias visuales: `PRODUCTO`, `SERVICIO`, `KIT`.
3. **Manejo de KITS de Seguridad:**
   * Presenta al cliente el Kit como una solución integral con su precio total.
   * Imprime de forma ordenada el detalle de componentes incluidos (*"Incluye: 4× Cámara Bullet 2MP, 1× Grabador NVR 4 Ch, 1× Disco 1TB, 4× Baluns"*).
4. **Alícuotas de IVA y Multimoneda:**
   * Discriminación exacta de IVA (10.5%, 21%, etc.) con cálculo transparente de subtotal neto, descuento, neto gravado e IVA resultante.
   * Soporte simultáneo para **Dólares Estadounidenses (USD)** y **Pesos Argentinos (ARS)**.
   * Integración con cotización oficial del dólar en vivo y botón de actualización instantánea.
5. **Caducidad y Notas Comerciales:**
   * Barra de vigencia configurable (ej. "Cotización válida por 15 días luego de su emisión").
   * Caja de notas y condiciones comerciales con ajuste dinámico de tipografía según longitud del texto.

---

### MÓDULO 3: Catálogo Comercial de Seguridad & Listas Gremio

1. **Gestión de Marcas y Categorías:**
   * Organización por fabricantes líderes (Hikvision, Dahua, DSC, Paradox, Garnet, Ubiquiti, etc.).
   * Categorías multinivel: Cámaras CCTV, Grabadores, Centrales de Alarma, Sensores, Cerco Eléctrico, Automatización, Redes.
2. **Precios Duales (Público vs. Gremio):**
   * Cada producto cuenta con su Precio de Lista (Público Final) y su **Precio Gremio** (descuento mayorista para instaladores, gremio o abonados).
   * Al armar la cotización, con un solo interruptor el vendedor aplica la lista Gremio o Público. El PDF resultante refleja la condición comercial seleccionada.
3. **Control de Márgenes y Costos:**
   * Registro del costo de compra en origen para calcular márgenes brutos de ganancia en cada venta.

---

### MÓDULO 4: Pipeline Comercial (Funnel de Ventas Kanban)

1. **Gestión Visual de Oportunidades:**
   * Tablero Kanban interactivo con etapas de venta totalmente configurables.
   * Monto totalizado por columna en tiempo real.
   * Arrastre de tarjetas para cambiar de fase comercial.
2. **Integración Total con Cotizaciones y WhatsApp:**
   * Cada tarjeta de oportunidad muestra las cotizaciones asociadas, el estado del presupuesto (Guardado, Enviado, Aceptado, Rechazado) y los chats de WhatsApp previos.
3. **Filtros por Vendedor y Organización:**
   * Los directores ven la carga de trabajo y efectividad de cada vendedor.
   * Los vendedores tienen una vista limpia de su día a día.

---

### MÓDULO 5: Depósito, Stock y Órdenes de Entrega

1. **Conteo Físico Inicial (Stock sin Factura):**
   * Soluciona el problema de empresas que ya poseen cientos de cámaras, cables o sensores en depósito pero no tienen las facturas de compra a mano.
   * Modal de "Conteo Inicial" que permite seleccionar cualquier producto del catálogo o producto propio, fijar la cantidad real contada y asentar el inventario con un clic.
2. **Órdenes de Entrega y Remitos (`/entregas`):**
   * Al ganar una cotización, con el botón *"Preparar materiales"* el CRM crea una entrega pendiente y descuenta la mercadería del stock para evitar ventas duplicadas.
   * Emisión de remito con firma de recepción para el técnico instalador o el cliente.
3. **Historial de Movimientos y Auditoría:**
   * Trazabilidad completa: quién ingresó o egresó cada unidad, fecha, motivo y número de documento vinculado.

---

### MÓDULO 6: Facturación, Comprobantes y Portal de Clientes

1. **Conexión con Organismos Fiscales (AFIP / ARCA):**
   * Facturas electrónicas oficiales generadas sin salir de la plataforma.
   * Generación automática de comprobantes con código QR reglamentario.
2. **Cuenta Corriente de Clientes:**
   * Registro de saldos pendientes, pagos parciales y recibos de cobro.
3. **Portal de Autogestión (`/portal`):**
   * Acceso por enlace único cifrado para que el cliente final:
     * Descargue sus facturas y cotizaciones en PDF de alta calidad.
     * Apruebe o rechace propuestas comerciales online.
     * Visualice los servicios o abonos contratados.
     * Pague a través de pasarelas de pago integradas.

---

### MÓDULO 7: Mesa de Ayuda, Tickets y Postventa

1. **Gestión de Incidencias Técnicas:**
   * Tickets de soporte con asignación de responsable, prioridad y estado (Abierto, En Progreso, Resuelto, Cerrado).
2. **Calificación de Atención (`/valorar-ticket`):**
   * Envío automático de encuesta de satisfacción al cliente tras resolver una asistencia técnica o instalación.
3. **Derivación Directa desde el Bot de WhatsApp:**
   * Si un abonado escribe fuera de horario por un falso disparo de alarma o fallo de batería, el bot abre el ticket con los datos del abonado para que la guardia actúe de inmediato.

---

### MÓDULO 8: Dashboard Ejecutivo y Analítica en Tiempo Real

1. **Métricas Clave (KPIs):**
   * **Ingresos Mensuales Recurrentes (MRR):** Valor de los abonos de monitoreo y servicios activos.
   * **Volumen del Pipeline:** Dinero en juego ponderado por probabilidad de cierre.
   * **Tasa de Cierre / Conversión:** Porcentaje de cotizaciones que se convierten en ventas concretadas.
2. **Actividad y Rendimiento del Equipo:**
   * Total de llamadas, mensajes de WhatsApp, cotizaciones emitidas y facturas cobradas por agente comercial.

---

### MÓDULO 9: Arquitectura de Alto Rendimiento y Multitenancy

1. **Coinfraestructura de Baja Latencia (Vercel + Supabase):**
   * Despliegue optimizado en región `sfo1` coinubicado con el clúster de base de datos para eliminar latencias geográficas.
   * Transiciones entre pantallas instantáneas gracias al caché de TanStack Query y consultas indexadas de Prisma.
2. **Aislamiento Multi-Organización Estricto:**
   * Arquitectura multi-tenant lista para operar como software propio (White-Label) o gestionar múltiples sucursales con bases de datos aisladas.
3. **Seguridad y Respaldo:**
   * Autenticación basada en JWT / sesiones seguras con cifrado moderno.

---

## 4. Cuadro Comparativo: JustCRM vs. CRMs Tradicionales

| Característica | CRMs Tradicionales (HubSpot, Zoho, Salesforce) | JustCRM (Especializado Seguridad & IoT) |
|---|---|---|
| **Enfoque de Negocio** | Genérico (Software, Inmobiliario, etc.) | **100% Especializado en Seguridad, Instalaciones e IoT** |
| **Kits de Cámaras y Alarmas** | Requiere desarrollos o plugins caros | **Nativo (precio cerrado + componentes desglosados)** |
| **Listas de Precios** | Única lista estándar | **Dual Nativo: Público vs. Gremio / Instaladores** |
| **Bot de WhatsApp con IA** | Integraciones externas costosas | **Nativo con Gemini 2.5 + Catálogo + Derivación por área** |
| **Stock sin Factura (Conteo Inicial)** | Bloqueado o inexistente | **Resuelto: Conteo físico ágil en 1 clic** |
| **Facturación Fiscal (AFIP / ARCA)** | No disponible o mediante conector externo | **Nativa con CAE, IVA discriminado y QR legal** |
| **Costos de Licencia** | En dólares altos por usuario por mes | **Económico, flexible y escalable para toda la empresa** |

---

*Manual elaborado y certificado para la comercialización global de JustCRM by JustCreate.*
