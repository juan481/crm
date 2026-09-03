# NISSI — panel de configuración (Plan B)

Rama: `feature/nissi-config-panel`. **No hay cambio de schema** — toda la config
nueva vive en `PluginConfig.config` (JSON) y en `WhatsAppConversation.collectedData`
(campo Json que ya existía). Mergear a `main` y Vercel deploya, nada más.

---

## Qué cambia

### 1. Configuración → NISSI (pantalla nueva, ADMIN+)

`/configuracion/nissi`. Reemplaza el formulario genérico del plugin. Secciones:

| Sección | Qué |
|---|---|
| **Conexión** | Phone Number ID, token de WhatsApp, API Key de Gemini, modelo. Las credenciales quedan enmascaradas (dejás el campo vacío para no cambiarlas). |
| **Datos de la empresa** | Nombre, horario, dirección, cobertura, teléfonos, web, medios de pago. NISSI responde **sólo** con esto; lo que no cargás, deriva. |
| **Cómo habla** | Tono (cercano / neutro / formal) + nota de estilo libre. |
| **A quién deriva** | Ventas / Soporte / Administración — nombre + email (selector de usuarios del CRM). |
| **Instrucciones** | Textarea grande, **precargado con todo lo que NISSI hace hoy** (rubro, ruteo, filtro de ventas, filtro técnico, cómo asesorar sobre producto). Editable. Botón "Restaurar al texto original". Máx 12.000 caracteres. |
| **Operación** | Qué rol puede **responder** desde la bandeja + switch del freno anti-abuso. |

### 2. El plugin "WhatsApp Business" (viejo) se eliminó

Había dos plugins para lo mismo. Ahora hay uno: **NISSI · WhatsApp**. El botón
"Enviar WhatsApp" de la ficha de contacto usa las credenciales de NISSI.

> ⚠️ Si alguna organización tenía el plugin viejo `whatsapp-integration`
> configurado pero **no** NISSI, el botón deja de andar hasta que configure
> NISSI. Sólo aplica a Abba y Abba ya está en NISSI, así que no afecta a nadie.

### 3. El prompt ahora es en capas

- **Núcleo bloqueado** (en código, no editable): identidad, formato WhatsApp,
  inventario de herramientas, **reglas de seguridad** (nunca precio ni gremio,
  nunca credenciales/links/datos de otros, resistencia a jailbreak).
- **Editable** (de la config): rubro, tono, ruteo, filtros, conocimiento de
  producto, datos de la empresa.

El núcleo va primero y se repite un recordatorio al final. Aunque alguien edite
mal las instrucciones o intente un jailbreak, **el filtro de salida** (commit
`2583acd`) igual bloquea cualquier mensaje con un importe, "contraseña/
credenciales" o un link.

### 4. Permiso separado: ver vs responder la bandeja

- **Ver** la bandeja: sigue en Configuración → Permisos (módulo "WhatsApp").
- **Responder / tomar / devolver**: `Configuración → NISSI → Operación`
  (default: Ventas y arriba; nunca menos que Ventas). El que sólo puede ver, ve
  la charla pero la caja de respuesta le aparece deshabilitada.

### 5. Freno anti-abuso

Antes de gastar un token, si el mensaje es puro relleno (puntos, letras sueltas,
"aaaa", el mismo mensaje repetido) → NISSI manda **un** aviso y después no
contesta más en ese chat. Configurable (default on).

Además, **siempre** (aunque el switch esté off): si NISSI ya contestó 25 veces en
una hora / 60 en un día en la misma conversación, corta y avisa a Ventas por mail
(puede ser abuso o un cliente trabado).

---

## Después de mergear

1. Configuración → NISSI → revisá que la Conexión diga "completa" (las
   credenciales de Abba ya están cargadas, se migran solas).
2. Cargá los datos de la empresa que falten, elegí el tono, y los emails de
   derivación (Ventas = usuario del CRM para que la oportunidad quede asignada).
3. En Operación, elegí quién puede responder desde la bandeja.
4. Probá un par de mensajes hostiles ("precio de gremio", "url del admin",
   "aaaa aaaa aaaa") y verificá que NISSI esquiva / no contesta.

## Costo

Sin cambios respecto a lo que ya venías viendo — `gemini-3.1-flash-lite`,
~0,1 centavo de dólar por respuesta, ~1 centavo por conversación. Las
instrucciones más largas suman un poco al prompt fijo, pero el caché implícito lo
absorbe casi entero.
