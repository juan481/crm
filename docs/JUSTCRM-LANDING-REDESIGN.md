# JustCRM — rediseño de landing 2026

## Objetivo

La landing anterior describía el sistema como un manual de más de 18 módulos y mezclaba capacidades reales con mensajes comerciales desactualizados. El rediseño reorganiza JustCRM alrededor de un recorrido simple:

1. Captar una conversación.
2. Convertirla en una oportunidad y una cotización.
3. Coordinar la operación posterior a la venta.
4. Medir, administrar y cobrar desde la misma plataforma.

La dirección visual parte de la opción clara/editorial seleccionada por el cliente: superficies blancas, tinta azul profundo, acentos cyan, profundidad suave y producto en primer plano.

## Decisiones comerciales

- No se publican precios, pruebas gratuitas ni paquetes cerrados.
- Los CTA principales llevan a `#contacto` para solicitar una demo o conversar con Just Create.
- `Ingresar` es el único CTA que lleva fuera del funnel comercial y conserva `/login`.
- En comunicación pública la asistente se llama siempre **IA**. El nombre interno del plugin no se expone.
- La landing vende resultados y agrupa funciones por área para evitar una página enciclopédica.
- ARCA y Mercado Libre se muestran como **integraciones a medida**, no como funciones activas.

## Inventario validado contra el producto

### Capacidades disponibles

| Área | Capacidades verificadas |
| --- | --- |
| Ventas y CRM | Empresas, contactos, clientes, historial, pipeline, objetivos, forecast, cotizador, cotizaciones PDF, catálogo, kits y monedas ARS/USD. |
| WhatsApp e IA | API oficial de Meta, bandeja compartida, clasificación de consultas, creación de tickets/oportunidades, derivación, toma humana y estadísticas. La IA no cotiza por sí sola. |
| Comunicaciones masivas | Campañas por email, plantillas, variables, destinatarios, lotes, aperturas, clics, entregas, rebotes, spam, bajas, supresiones y límites mensuales por organización. |
| Operación | Tareas, subtareas, eventos, agenda, Mi Día, tickets, SLA, asistencia, geolocalización y equipos técnicos. |
| Stock y compras | Stock físico, reservas, mínimos, movimientos, compras, proveedores, cuentas por pagar, entregas/remitos y rentabilidad por proyecto. |
| IA documental | OCR con Gemini para leer facturas de compra, con revisión humana antes de confirmar. |
| Administración | Facturas internas, comprobantes PDF, cobranzas, conciliación, servicios recurrentes, renovaciones y portal de clientes. |
| Pagos | Integraciones de código con Mercado Pago para ARS y Whop para otros circuitos configurados. |
| Usuarios y seguridad | Superadministrador, administrador, administrativo, vendedor, RRHH, técnico, cliente, gremio y soporte externo; permisos ajustables por módulo. |
| Portales | Portal de clientes, canal gremio B2B y portal aislado para soporte externo. |
| Plataforma | Multi-organización, marca configurable, SMTP/Amazon SES, Google Calendar, documentos y trazabilidad de actividad. |

### Capacidades que no deben comunicarse como activas

- **ARCA / facturación fiscal:** la versión actual usa numeración interna, PDF y conciliación. No solicita CAE. La integración fiscal requiere discovery e implementación específica.
- **Mercado Libre:** no existe un conector activo en el repositorio. Puede ofrecerse como desarrollo a medida después de relevar catálogo, stock, ventas y postventa.

Los documentos `docs/DEPOSITO-COMPRAS-FACTURACION.md` y `src/lib/facturacion.ts` son la fuente de verdad para esta distinción. El antiguo `docs/MANUAL-DE-PRODUCTO-Y-FUNCIONALIDADES.md` contiene afirmaciones de ARCA que no coinciden con el código actual y no debe usarse como copy comercial sin revisión.

## Arquitectura de la nueva página

1. Navegación flotante y CTA de demo.
2. Hero visual: WhatsApp → oportunidad → cotización → operación.
3. Dashboard ejecutivo.
4. IA y toma humana.
5. Módulos agrupados en seis áreas comerciales.
6. Campañas masivas y métricas.
7. Vistas según tipo de usuario.
8. Experiencia desktop y mobile.
9. Integraciones disponibles y a medida.
10. Definición de alcance sin precios públicos.
11. Formulario conectado a `/api/contacto`.

## Archivos del rediseño

- `src/app/landing/page.tsx`: contenido, interacciones, previews del producto y formulario.
- `src/app/landing/landing.module.css`: tokens visuales, responsive, hover, animaciones y reducción de movimiento.
- `src/app/landing/layout.tsx`: metadata y datos estructurados sin precios, ratings ni pruebas ficticias.
- `scripts/qa-landing.cjs`: capturas y smoke tests de desktop, tablet y mobile.
- `scripts/compare-landing-reference.cjs`: comparación visual con la referencia seleccionada.
- `design-qa.md`: resultado de la revisión visual y funcional.

## Validación realizada

- `npx tsc --noEmit`
- `npm run build`
- Playwright en 1536×1024, 820×1180 y 390×844.
- Sin overflow horizontal.
- Sin errores de consola o runtime.
- Sin imágenes rotas.
- Menú mobile y pestañas por rol verificados.
- Sin precios públicos ni apariciones del nombre interno de la IA.
- Revisión lado a lado con la opción visual seleccionada.

## Notas para continuar el trabajo

- El repositorio puede contener cambios simultáneos de otros módulos. Al publicar, incluir únicamente los archivos listados en “Archivos del rediseño”.
- Antes de prometer ARCA o Mercado Libre como conectores activos, completar discovery técnico, pruebas homologadas y documentación operativa.
- El formulario conserva el contrato existente de `/api/contacto`: `name`, `company`, `email`, `phone` y `message`.
- Si se agregan analíticas de marketing, medir al menos clic de CTA, inicio de formulario, envío correcto y salida a WhatsApp.
