# Configuración de correo — CRM

Última actualización: 21/08/2026

## Estado actual

El CRM soporta dos formas de enviar email, elegibles por organización desde
**Configuración → Correo**:

- **SMTP / Brevo** — Gmail, Brevo, SendGrid, cualquier SMTP. Activo hoy para
  Just Create y Agencia Digital Pro.
- **Amazon SES** — activo para Abba Seguridad (`sesRegion: us-east-2`),
  incluyendo tracking de entregas/rebotes/spam/aperturas vía webhook SNS
  (`src/app/api/webhooks/ses/route.ts`).

El proveedor se guarda por organización (`Organization.smtpProvider`), así que
convive con clientes que sigan usando SMTP mientras otro usa SES.

### Activación de tracking en un clic (nuevo, 21/08/2026)

El paso 6 de abajo ("Tracking de entregas/rebotes/aperturas") ya no hace
falta hacerlo a mano en la consola de AWS — en Configuración → Correo,
con SES elegido como proveedor, hay un botón **"Activar métricas de
entrega"** que crea solo el topic de SNS, la suscripción del webhook, y el
Configuration Set de SES conectado a todo eso
(`src/app/api/settings/email/ses-autoconfig/route.ts`). El paso a paso
manual de abajo queda documentado como alternativa por si se prefiere
armarlo a mano, o si el usuario IAM del cliente no tiene los permisos que
el botón necesita (`ses:CreateConfigurationSet`,
`ses:CreateConfigurationSetEventDestination`, `sns:CreateTopic`,
`sns:Subscribe`) — en ese caso el botón devuelve el mensaje de error
explicando qué permiso falta.

**Caso real que motivó esto**: Abba Seguridad tenía SES activo y mandando
mails bien hace semanas, pero nunca se había armado el Configuration Set
— las 10 campañas ya enviadas mostraban 0 en entregados/abiertos/rebotados/
spam en Comunicaciones, no porque la funcionalidad estuviera rota (estaba
completa) sino porque AWS nunca había sido configurado para avisar esos
eventos. Confirmado contra la base real (`sesConfigSet: null`) antes de
armar el fix. Comunicaciones también avisa esto solo ahora: si el
proveedor es SES y todas las campañas enviadas muestran 0 en las 4
métricas, aparece un banner invitando a activar el tracking.

## Migración a Amazon SES — paso a paso

### Lo que hago yo (agencia)

1. **Verificar el dominio en SES**
   AWS Console → SES → Identidades → "Crear identidad" → elegir **dominio**
   (no un email suelto, para poder mandar a cualquier destinatario más adelante).
   SES entrega 3 registros **CNAME** (DKIM) y a veces un **TXT** — hay que
   cargarlos en el DNS del dominio del cliente.

2. **Crear un usuario IAM** solo para el envío de mails, con esta política mínima:
   ```json
   {
     "Effect": "Allow",
     "Action": ["ses:SendEmail", "ses:SendRawEmail"],
     "Resource": "*"
   }
   ```

3. **Generar Access Key ID + Secret Access Key** de ese usuario
   (IAM → usuario → Credenciales de seguridad → Crear clave de acceso).
   El Secret solo se muestra una vez — guardarlo en el gestor de contraseñas.

4. **Pedir salida del modo sandbox**
   SES → Account Dashboard → "Request production access".
   Mientras el proyecto esté en sandbox, **solo se puede mandar a
   direcciones verificadas manualmente** — inútil para producción.
   Tarda 1–2 días hábiles. AWS pregunta:
   - Caso de uso: transaccional (cotizaciones, notificaciones a clientes).
   - Volumen estimado (aproximar según cantidad de cotizaciones/mes).
   - Manejo de rebotes/quejas: ya hay un webhook SNS que marca bounces y
     spam automáticamente en la base (ver más abajo).

5. **Cargar credenciales en el CRM**
   Configuración → Correo → elegir "Amazon SES" → completar:
   - Región AWS (la misma donde se verificó el dominio)
   - Access Key ID
   - Secret Access Key
   - Email remitente (debe ser del dominio verificado, ej. `noreply@sudominio.com`)
   - Configuration Set (opcional, solo para tracking)
   → "Probar conexión" → "Guardar configuración".

6. **(Opcional) Tracking de entregas/rebotes/aperturas**
   - SES → Configuration Sets → crear uno → asociarlo al campo
     "Configuration Set" del paso 5.
   - SNS → Topics → crear un topic estándar → Suscripción tipo **HTTPS**
     apuntando a: `https://<dominio-del-crm>/api/webhooks/ses`
     (la confirmación de la suscripción la hace el sistema solo).
   - En el Configuration Set → Event Destinations → asociar el topic y
     activar los eventos: Delivery, Bounce, Complaint, Open.

### Lo que le pido al cliente

- Acceso al panel de DNS de su dominio (o que él mismo cargue los 3
  registros CNAME que entrega AWS al verificar el dominio en el paso 1).
- Confirmación de qué dirección va a figurar como remitente
  (ej. `contacto@suempresa.com` o `noreply@suempresa.com`), que tiene que
  ser de un dominio que él controle.
- Nada más técnico de su parte — credenciales, IAM y configuración de SES
  las maneja la agencia.

### Importante antes de avisarle al cliente que ya está migrado

- No anunciar el cambio hasta tener la **aprobación de producción** (paso 4).
  Antes de eso, probar únicamente con el propio email verificado a mano.
- Verificar que el "Email remitente" cargado en el paso 5 sea exactamente
  una dirección del dominio verificado — si no, SES rechaza el envío.

## Bugs encontrados y corregidos (21/07/2026)

Al revisar la implementación antes de migrar, aparecieron 3 problemas que
iban a romper el envío en cuanto SES quedara activo (ya corregidos y
pusheados a `main`, commit `8db8832`):

1. El envío por SES usaba una API que no soporta adjuntos — el PDF de las
   cotizaciones se hubiera perdido en silencio. Ahora arma un mensaje MIME
   crudo cuando hay adjuntos y lo manda por `SendRawEmail`.
2. Las rutas de "enviar cotización por mail" y "enviar mail a contactos de
   empresa" no leían el proveedor configurado — seguían intentando SMTP
   aunque la organización tuviera SES activo.
3. El botón "Enviar por mail" del cotizador mostraba "Email no configurado"
   aunque SES estuviera bien cargado (el chequeo solo miraba campos SMTP).

Toda la lógica de resolución de proveedor quedó centralizada en
`resolveOrgSmtpConfig()` / `isOrgEmailConfigured()` dentro de
`src/lib/email.ts`, usada por los 5 puntos del código que mandan email.
