# Guía de Importación de Clientes — JustCRM

## Cómo importar

1. En el CRM, ir a **Clientes → Importar (ícono de descarga)**
2. Preparar el archivo Excel o CSV con la estructura indicada abajo
3. Arrastrar el archivo o hacer clic en "Seleccionar archivo"
4. Revisar la vista previa y confirmar

---

## Estructura del archivo

El archivo puede ser `.xlsx` (Excel) o `.csv`. La **primera fila debe ser el encabezado** con exactamente estos nombres de columna:

| Columna | Requerido | Tipo | Ejemplo | Notas |
|---------|-----------|------|---------|-------|
| `name` | ✅ Sí | Texto | `Juan García` | Nombre completo o razón social |
| `email` | ✅ Sí | Email válido | `juan@empresa.com` | Debe ser un email válido. Si ya existe en el CRM, la fila se omite |
| `phone` | No | Texto | `+54 11 4567-8900` | Teléfono de contacto |
| `company` | No | Texto | `Empresa S.A.` | Nombre de la empresa |
| `country` | No | Texto | `Argentina` | País (texto libre) |
| `city` | No | Texto | `Buenos Aires` | Ciudad |
| `position` | No | Texto | `Gerente de Seguridad` | Se importa como tag del cliente |

### Notas importantes
- Los campos **`name`** y **`email`** son obligatorios. Filas sin estos datos se omiten automáticamente.
- Los emails deben tener formato válido (ej: `usuario@dominio.com`). Los inválidos se omiten.
- Si el email **ya existe** en el CRM para tu organización, la fila se omite (no crea duplicados).
- Los clientes importados quedan con estado **PROSPECTO** y tipo **B2B**.
- Límite máximo por importación: **2.000 clientes**.

---

## Ejemplo de archivo correcto

### Excel (vista de celdas)

| name | email | phone | company | country | city | position |
|------|-------|-------|---------|---------|------|----------|
| Juan García | juan@empresa.com | +54 11 4567-8900 | Empresa SA | Argentina | Buenos Aires | Gerente |
| María López | maria@colegio.edu.ar | | Colegio San Martín | Argentina | Córdoba | Directora |
| Carlos Ruiz | carlos.ruiz@gmail.com | +54 9 351 555-1234 | | Argentina | Rosario | |
| Grupo ABC | contacto@grupoabc.com.ar | 0800-222-3333 | Grupo ABC SRL | Argentina | Mendoza | |

### CSV equivalente

```
name,email,phone,company,country,city,position
Juan García,juan@empresa.com,+54 11 4567-8900,Empresa SA,Argentina,Buenos Aires,Gerente
María López,maria@colegio.edu.ar,,Colegio San Martín,Argentina,Córdoba,Directora
Carlos Ruiz,carlos.ruiz@gmail.com,+54 9 351 555-1234,,Argentina,Rosario,
Grupo ABC,contacto@grupoabc.com.ar,0800-222-3333,Grupo ABC SRL,Argentina,Mendoza,
```

---

## Errores frecuentes y cómo evitarlos

| Error | Causa | Solución |
|-------|-------|----------|
| "0 contactos importados" | Todos los emails ya existen o son inválidos | Revisar que los emails sean únicos y con formato correcto |
| Fila omitida | Email inválido o falta el nombre | Verificar columnas `name` y `email` |
| El archivo no se procesa | Formato incorrecto | Guardar como `.xlsx` desde Excel o como `.csv` con codificación UTF-8 |
| Caracteres extraños (ñ, á, é) | Codificación incorrecta en CSV | Guardar el CSV como **UTF-8** (en Excel: "Guardar como → CSV UTF-8") |

---

## Campos que NO se importan (se asignan por defecto)

| Campo | Valor por defecto | Dónde cambiarlo |
|-------|-------------------|-----------------|
| Estado | PROSPECTO | Ficha del cliente |
| Tipo de cliente | B2B | Ficha del cliente |
| MRR | $0 | Ficha del cliente |
| Vendedor asignado | Sin asignar | Ficha del cliente |
| Servicio | Sin asignar | Ficha del cliente |

---

## Plantilla descargable

Crear un archivo `plantilla-importacion.xlsx` con las siguientes columnas en la primera fila:

```
name | email | phone | company | country | city | position
```

Copiar esta primera fila como encabezado y completar las filas siguientes con los datos de los clientes.

---

## Preguntas frecuentes

**¿Puedo importar más de 2.000 clientes?**  
No en una sola operación. Dividir el archivo en partes de hasta 2.000 filas e importar por tandas.

**¿Qué pasa si importo un cliente que ya existe?**  
El sistema detecta el email duplicado y omite esa fila automáticamente. No modifica el cliente existente.

**¿Se pueden actualizar clientes existentes con la importación?**  
No. La importación solo crea clientes nuevos. Para actualizar, usar la ficha individual de cada cliente.

**¿Los clientes importados aparecen en el pipeline?**  
Quedan como **Prospectos** en la lista de clientes. Para pasarlos al pipeline, crear un deal desde la ficha del cliente.

**¿Cómo importo desde un CRM anterior?**  
Exportar desde el CRM anterior en formato CSV o Excel, adaptar las columnas al formato indicado arriba, y luego importar.
