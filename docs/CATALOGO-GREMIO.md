# Catálogo Gremio (B2B)

El portal B2B (Gremio) es un módulo independiente pensado para compras por volumen o revendedores.

## Flujo del Catálogo
1. **Acceso Lateral**: Los usuarios con rol `GREMIO` acceden directamente a `(gremio)/layout.tsx` sin pasar por el portal interno del CRM.
2. **Dual-Pricing**: El catálogo cuenta con dos precios:
   - `Product.price`: Precio sugerido al público / cliente final.
   - `Product.precioGremio`: Precio especial para B2B.
3. **Sincronización**: Los precios y el catálogo se pueden sincronizar a través de Excel o Google Sheets.
4. **Carrito y Pedidos**:
   - Los clientes Gremio pueden armar un carrito de compras y emitir un pedido B2B.
   - Los pedidos impactan en el backend interno del CRM, permitiendo al equipo de ventas hacer un seguimiento del ciclo (revisión de stock, aprobación, y facturación).

## Configuración y Reglas
- Un `Product` que es un `KIT` no se expone al portal Gremio.
- El costo y márgenes de los productos NUNCA son expuestos al portal de clientes Gremio, se mantienen a nivel interno para la vista del Administrador.
