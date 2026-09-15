# Arquitectura de Datos: Empresa y DirectorioContacto

El CRM ha evolucionado desde un modelo plano de `Client` hacia una arquitectura robusta orientada a entidades separadas, permitiendo relaciones complejas (B2B, B2C, multi-contactos).

## Empresa (`Empresa`)
Representa una entidad o individuo con el cual el CRM interactúa comercialmente.
- **Tipos de empresas**: `EMPRESA` (persona jurídica) y `CONSUMIDOR_FINAL` (individuo).
- **Dualidad Cliente/Proveedor**: Una empresa puede ser cliente, proveedor, o ambas al mismo tiempo (`isCliente`, `esProveedor`).
- **Abonos y Facturación**: Soporta múltiples abonos recurrentes (`ServicioRecurrente`).

## Persona de Contacto (`DirectorioContacto`)
Representa a una persona individual física.
- **Vínculos flexíbles**: Puede estar vinculada a una empresa (`empresaId`) o no. Por ejemplo, en escenarios B2B se asocia a la `Empresa`, pero en escenarios B2C puede quedar suelta, operando como consumidor individual.
- **Comunicaciones y Facturación**: Uno o varios contactos pueden estar marcados para recibir facturas y correos (`recibeFacturas`).

## Unificación Omnicanal
Cada entidad (`Empresa` y `DirectorioContacto`) cuenta con su propio historial de actividad o "Timeline" (`EmpresaNota` y `DirectorioContactoNota`). Esto asegura que cada interacción de negocio, desde un mail o un mensaje de WhatsApp hasta una reunión de venta, queda unificada en la ficha que corresponda de manera central.
