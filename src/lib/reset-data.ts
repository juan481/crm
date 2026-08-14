// Palabra de confirmación para POST /api/settings/reset-data — un solo
// lugar, importado tanto por la UI (configuracion/page.tsx) como por el
// propio endpoint, para que no puedan divergir. Antes eran dos strings
// hardcodeados por separado ("LIMPIAR" en la UI, "RESETEAR" en el body real
// que se mandaba) — funcionaba porque coincidían por casualidad, pero
// corregir uno sin el otro rompía el flujo en silencio.
export const RESET_DATA_CONFIRM_WORD = 'RESETEAR'
