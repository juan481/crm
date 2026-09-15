# Depósito: Stock, Compras (OCR), Entregas y Facturación

Módulo del CRM para que Abba deje de depender de Bejerman/planillas sueltas: stock
propio con historial inmutable, ingreso de mercadería sacándole una foto a la
factura del proveedor (IA lee los datos), alertas cuando cambia un costo, egreso
de material descontado automáticamente contra la venta/obra, y facturación de
venta con rentabilidad real por proyecto.

**No emite CAE de AFIP/ARCA** — es registro + PDF por mail. Facturación
electrónica fiscal es un proyecto aparte (discovery, no arrancado).

Construido en 4 fases, todas en producción (`main`, esquema ya pusheado a la
Supabase compartida).

---

## 1. Qué hay en cada pantalla

### `/stock` — Depósito · Stock
3 pestañas (`src/components/stock/`):
- **Stock actual** (`stock-actual-tab.tsx`): productos con `trackStock` activado.
  Columnas Depósito / Reservado / Disponible / Mínimo / Proveedor. Filtros: bajo
  mínimo, sin stock, sin movimiento reciente. Acción por fila: entrada/salida/
  ajuste manual (mismo endpoint atómico de siempre, `POST /api/products/[id]/stock`).
- **Movimientos** (`movimientos-tab.tsx`): historial **inmutable** de
  `StockMovimiento` (no tiene PATCH/DELETE) — cada fila muestra origen
  (COMPRA/VENTA/AJUSTE/INICIAL/MANUAL) y enlaza a la Compra/Entrega/Deal que lo
  generó. Export a Excel.
- **Alertas** (`alertas-tab.tsx`): `AlertaCosto` PENDIENTE (origen COMPRA o
  SYNC) — "Aplicar el nuevo costo" o "Descartar".

Cron diario `stock-bajo` avisa cuando un producto queda debajo de `stockMinimo`.

### `/compras` — Depósito · Compras
- **`compra-form.tsx`**: alta de una compra, de dos formas —
  - **"Cargar factura"**: subís foto/PDF → Gemini (OCR) devuelve proveedor,
    items, montos → pantalla de revisión editable (match de producto por
    SKU/MPN/similitud de nombre, delta de costo vs el actual, aviso de
    moneda si no coincide).
  - **"Carga manual"**: mismo formulario vacío, por si no hay foto o falla el
    OCR — nunca bloquea la carga.
  Al confirmar: transacción única → `Compra` CONFIRMADA + `CompraItem[]` +
  movimiento de stock Entrada por cada ítem con `trackStock` + `AlertaCosto`
  si el costo cambió (ver §3).
- **`compra-detail.tsx`**: ver/anular una compra ya cargada, adjunto de la
  factura (imagen/PDF vía `Document`).
- **`cuentas-por-pagar.tsx`**: compras con `estadoPago` PENDIENTE/PARCIAL,
  aging 0-30/30-60/60+, registrar `CompraPago` (pago parcial o total).

### `/entregas` — Depósito · Entregas
- **`entrega-form.tsx`** / **`entrega-detail.tsx`**: remito interno de salida
  de material. Se genera de dos formas:
  - Desde una **cotización ACEPTADA** (`cotizaciones/[id]`, botón "Preparar
    materiales") → crea `EntregaStock` BORRADOR con los ítems (KITs expandidos
    a sus componentes), sube `stockReservado`. Al **confirmar la entrega**:
    `registrarMovimiento` Salida por ítem (baja `stock` y `stockReservado`,
    queda ligado a la Cotización/Deal).
  - **Suelta** (venta de mostrador, sin Deal), alta directa desde `/entregas`.
  Remito imprimible en PDF (`pdf-branding.ts`).

### `/proveedores`
Calcada de `/clientes` filtrando `Empresa.esProveedor = true`. El checkbox "Es
proveedor" + CBU/alias vive en el mismo `EmpresaForm` de siempre.

### Pipeline (Deal) → pestaña **Materiales** y **Rentabilidad**
`src/components/pipeline/deal-rentabilidad.tsx`: por Deal, ingresos (facturas
emitidas / cotizaciones aceptadas) − costos reales (entregas de stock + compras
vinculadas) = margen real, comparado contra el margen cotizado. Alerta visual
si se desvía.

### Facturación (`/facturas`)
"Emitir factura" desde una cotización aceptada copia los ítems a `InvoiceItem`
con numeración interna correlativa por organización. PDF + "Enviar comprobante"
por mail (mismo motor que el resto de la facturación), marca `Invoice.sentAt`.

---

## 2. Modelo de datos nuevo (100% aditivo, sin DROP)

- `Empresa.esProveedor`, `cbu`, `alias`
- `Product.stockMinimo`, `stockReservado`, `supplierStock`
- `StockMovimiento` extendido: `origen`, `compraId`, `entregaId`, `dealId`,
  `numeroComprobante`, `costoUnitario`
- `Compra` / `CompraItem` / `CompraPago`
- `EntregaStock` / `EntregaStockItem`
- `AlertaCosto` (con `nota` para deltas sospechosos — ver §3)
- `Invoice` extendido: `numeroInterno`, `tipo`, `cotizacionId`, `dealId`,
  `subtotal`, `iva`, `sentAt` + `InvoiceItem`
- `Deal.tipo`, `Cotizacion.entregaGenerada`

---

## 3. El OCR y las alertas de costo — cómo evitan falsos positivos

**Origen del problema (reportado por el cliente con capturas de +156921% /
-100% de "aumento"):** la comparación de costos no distinguía moneda (factura
en ARS contra `Product.costo` guardado en USD) y el sync del catálogo pisaba
costos válidos con celdas vacías/0 de la planilla del proveedor.

**Cómo quedó resuelto:**
- `precioSaneado()` (`src/lib/catalogo-sync.ts`): si el valor nuevo del Sheet
  es null/0/vacío, o si el salto es absurdo (±500%), **conserva el valor
  anterior** y deja constancia en `AlertaCosto.nota` en vez de pisar el
  catálogo a ciegas.
- `esCambioDeCostoRelevante()` / `esVariacionAbsurda()` (`src/lib/compras.ts`):
  al confirmar una compra, sólo se calcula/muestra el delta de costo si
  `costoMoneda` de la factura coincide con la moneda guardada del producto.
  Si no coincide, se muestra el costo actual en su moneda sin comparar
  porcentajes.
- **En la pantalla de revisión** (`compra-form.tsx`): ▲/▼% sólo aparece si las
  monedas coinciden; si no, "costo actual en otra moneda"; si el salto igual
  es absurdo con la misma moneda, aviso amarillo "revisá" en vez de un
  porcentaje gigante.

**Pendiente de este punto (no bug, es un paso manual):** un ítem de la factura
que no matchea ningún producto existente queda marcado para "Vincular
producto" — se resuelve a mano en la misma pantalla (buscar o crear el
producto ahí) antes de confirmar.

---

## 4. Antes de cargar una factura real — checklist

1. **API key de Gemini** cargada en Configuración → NISSI (`geminiApiKey`).
   Si falta, el OCR no rompe nada: avisa con un mensaje claro y permite cargar
   los datos a mano con la foto igual adjunta (carga manual).
2. **Proveedor** de la factura existe como Empresa con "Es proveedor" tildado
   (o se crea inline en la misma pantalla de revisión).
3. Los productos de la factura tienen **"Controlar stock" activado** en su
   ficha — si no, la compra se carga y factura igual, pero no suma unidades
   al depósito (por diseño: son productos que no se trackean).
4. **Moneda** de la compra coincide con la moneda real de la factura (ARS/USD)
   para que el delta de costo se calcule bien.

Cargar dos facturas seguidas es seguro: cada "Cargar factura" desmonta y
vuelve a montar el formulario de cero (sin estado de la anterior), no hay
límite de una por día, y la numeración correlativa (`Compra.number`) se asigna
recién al confirmar.

---

## 5. Permisos

Módulos nuevos en `src/lib/modules.ts` (aparecen solos en Configuración →
Permisos, `roleHasModule()` los respeta en cada API):

| Módulo | Piso por defecto |
|---|---|
| `stock` | ADMIN+ (mínimo configurable hasta TECHNICIAN) |
| `compras` | ADMIN+ |
| `entregas` | ADMIN+ (mínimo configurable hasta TECHNICIAN) |

---

## 6. Pendiente / fuera de alcance de este módulo

- **Fase 5 (discovery aparte, no arrancada)**: factura electrónica fiscal
  (AFIP/ARCA, CAE) e integración con SoftGuard ("Ultra", central de monitoreo).
- Rentabilidad del Deal usa el `Product.costo` del momento para el margen
  cotizado — si el costo cambió después de cotizar, el margen cotizado mostrado
  es el de hoy, no el histórico exacto del día de la cotización.
