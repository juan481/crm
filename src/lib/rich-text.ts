// Helpers para el cuerpo de plantillas / campañas de email.
//
// El editor rich (rich-editor.tsx) trabaja con HTML. Pero las plantillas que se
// crearon antes de que el editor existiera se guardaron en texto plano con
// saltos de línea `\n`. Si ese texto se mete crudo en un contentEditable, los
// saltos se pierden. `toEditorHtml` detecta ese caso y lo convierte.

/** ¿El string ya parece HTML del editor (tiene tags conocidos)? */
export function looksLikeHtml(s: string): boolean {
  return /<(?:p|div|br|img|ul|ol|li|h[1-6]|a|blockquote|strong|em|b|i|u|span|hr|table)\b[^>]*>/i.test(s)
}

/**
 * Prepara el cuerpo de una plantilla/campaña para cargarlo en el editor rich.
 * Si ya es HTML lo devuelve tal cual; si es texto plano (plantilla vieja) lo
 * escapa y convierte los saltos de línea en `<br>`.
 */
export function toEditorHtml(body: string | null | undefined): string {
  const s = body ?? ''
  if (!s) return ''
  if (looksLikeHtml(s)) return s
  const esc = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return esc.replace(/\r?\n/g, '<br>')
}
