// Fixed destination for the "request a quota increase" CTA — a WhatsApp
// deep link to the agency, not a self-service control (see scripts/set-email-limit.ts
// for why the limit itself isn't editable from any org-facing screen).
export const EMAIL_LIMIT_WHATSAPP_URL =
  `https://wa.me/541124527669?text=${encodeURIComponent('Hola, necesito aumentar mi límite de correos electrónicos.')}`
