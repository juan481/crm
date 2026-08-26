import { redirect } from 'next/navigation'

// Productos y Servicios se unificaron en una sola pantalla — ver
// /configuracion/catalogo (pestaña Productos incluye tanto los cargados a
// mano como el catálogo del proveedor). Este redirect existe sólo para no
// romper links/favoritos viejos a esta URL.
export default function ConfiguracionProductosRedirect() {
  redirect('/configuracion/catalogo')
}
