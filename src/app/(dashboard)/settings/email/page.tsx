import { redirect } from 'next/navigation'

export default function SettingsEmailRedirect() {
  redirect('/configuracion/correo')
}
