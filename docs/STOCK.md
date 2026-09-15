# Módulo de Stock

El módulo de Stock del CRM permite gestionar el inventario de productos de forma flexible.

## Añadir Stock (Con o Sin Factura)

### 1. Stock proveniente de compras (Con factura)
Cuando ingresas una nueva `Compra` al sistema (factura de proveedor o ticket), los artículos comprados automáticamente sumarán stock (si el producto tiene activado el seguimiento de inventario `trackStock`).

### 2. Cargar Stock inicial o manual (Sin factura)
Si necesitas dar de alta mercadería que ya poseías o que ingresa sin factura, puedes hacerlo de dos maneras:
- **Carga de Conteo Inicial**: Utiliza el botón `Cargar conteo inicial` en la vista de inventario. Esto registrará una entrada por el total establecido.
- **Movimiento Manual**: Ve a la pestaña de `/stock` -> `Movimiento`, selecciona `Entrada` y luego el origen `MANUAL`. Esto registrará el alta del producto indicando que no está atado a una orden de compra o comprobante externo, manteniendo una trazabilidad limpia del movimiento de la mercadería.
