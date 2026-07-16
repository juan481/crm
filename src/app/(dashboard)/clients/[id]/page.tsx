import { redirect } from 'next/navigation'

export default function ClientDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/clientes/${params.id}`)
}
