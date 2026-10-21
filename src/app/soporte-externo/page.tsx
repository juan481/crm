import { redirect } from 'next/navigation'

// /soporte-externo a secas (ej. el redirect('/soporte-externo') de
// (dashboard)/layout.tsx) no tiene contenido propio — tickets es la única
// sección de este portal.
export default function SoporteExternoIndexPage() {
  redirect('/soporte-externo/tickets')
}
