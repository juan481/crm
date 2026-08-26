import { redirect } from 'next/navigation'

// Ver /configuracion/catalogo (pestaña Servicios) — este redirect existe
// sólo para no romper links/favoritos viejos a esta URL.
export default function ConfiguracionServiciosRedirect() {
  redirect('/configuracion/catalogo')
}
