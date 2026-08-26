import { redirect } from 'next/navigation'

// /gremio a secas (ej. el redirect('/gremio') de (dashboard)/layout.tsx)
// no tiene contenido propio — el catálogo es el destino natural al entrar.
export default function GremioIndexPage() {
  redirect('/gremio/catalogo')
}
