import type { Metadata } from 'next'
import { PrintButton } from './print-button'

export const metadata: Metadata = {
  title: 'Configuración del Sistema CRM',
  description: 'Formulario de relevamiento para configurar tu CRM personalizado',
}

export default function SetupClientePage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Print styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Poppins', Arial, sans-serif; background: #f8fafc; color: #1e293b; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* Print / download button */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <p className="text-sm font-medium text-gray-600">Formulario de configuración CRM</p>
        <PrintButton />
      </div>

      <div className="page max-w-3xl mx-auto bg-white my-8 rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }} className="px-10 py-8">
          <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-2">JustCreate</p>
          <h1 className="text-white text-2xl font-bold mb-1">Formulario de Configuración</h1>
          <p className="text-indigo-200 text-sm">Completá esta información para que podamos dejar tu sistema listo en el menor tiempo posible.</p>
        </div>

        <div className="px-10 py-8 space-y-10">
          {/* Intro */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
            <p className="text-sm text-indigo-700 leading-relaxed">
              Este formulario nos permite personalizar completamente tu CRM: desde los colores de tu marca hasta los usuarios que tendrán acceso, los servicios que ofrecés y la base de datos de contactos inicial.
              Podés completarlo a mano o digitalmente, y enviárnoslo por email o WhatsApp.
            </p>
          </div>

          {/* SECCIÓN 1 */}
          <Section number="01" title="Datos de la Empresa">
            <Row label="Nombre de la empresa / marca" />
            <Row label="Nombre del sistema (aparece en el menú)" hint="Ej: CRM Seguridad, Mi Panel, GestorPro" />
            <Row label="Sitio web" />
            <Row label="Email de contacto principal" />
            <Row label="Teléfono de contacto" />
            <TwoCol>
              <Row label="Color principal (código HEX o descripción)" hint="Ej: #1e3a5f o 'azul oscuro'" />
              <Row label="Color secundario (opcional)" />
            </TwoCol>
            <Row label="¿Tienen logo en formato PNG o SVG?" hint="Sí / No / Lo enviamos por separado" />
          </Section>

          {/* SECCIÓN 2 */}
          <Section number="02" title="Configuración de Email (para envío de campañas)">
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-4">
              <p className="text-xs text-amber-700">
                Para poder enviar emails desde el sistema (campañas, notificaciones, cotizaciones) necesitamos los datos SMTP de su correo corporativo.
                Si usán Google Workspace, la configuración es simple. Si no tienen, podemos configurar un servicio de envío gratuito.
              </p>
            </div>
            <TwoCol>
              <Row label="Proveedor de email" hint="Ej: Google Workspace, Outlook, Otro" />
              <Row label="Email remitente" hint="Ej: info@miempresa.com" />
            </TwoCol>
            <TwoCol>
              <Row label="Host SMTP" hint="Ej: smtp.gmail.com" />
              <Row label="Puerto SMTP" hint="Generalmente 587 o 465" />
            </TwoCol>
            <Row label="Usuario SMTP (normalmente el mismo email)" />
            <Row label="Contraseña de aplicación SMTP" hint="En Gmail: Cuenta → Seguridad → Contraseñas de aplicación" />
          </Section>

          {/* SECCIÓN 3 */}
          <Section number="03" title="Usuarios del Sistema">
            <p className="text-xs text-gray-500 mb-4">
              Listá todos los usuarios que necesitan acceso. <strong>Roles disponibles:</strong>{' '}
              <span className="font-mono bg-gray-100 px-1 rounded">ADMIN</span> (acceso total),{' '}
              <span className="font-mono bg-gray-100 px-1 rounded">VENDEDOR</span> (clientes, pipeline, cotizador),{' '}
              <span className="font-mono bg-gray-100 px-1 rounded">TÉCNICO</span> (agenda del día, tickets, cotizador).
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['Nombre completo', 'Email', 'Rol', 'Teléfono'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 border border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="border border-gray-200 px-3 h-10" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* SECCIÓN 4 */}
          <Section number="04" title="Servicios / Productos a Cotizar">
            <p className="text-xs text-gray-500 mb-4">
              Estos son los servicios que aparecerán en el Cotizador y en el catálogo de ventas. Completá todos los que ofrecen.
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['Nombre del servicio', 'Descripción breve', 'Precio', 'Moneda', 'Período'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 border border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Monitoreo 24x7', '', '', 'ARS / USD', 'Mensual'],
                  ['Smart Panics', '', '', 'ARS / USD', 'Mensual'],
                  ['Clean Up', '', '', 'ARS / USD', 'Única vez'],
                  ['', '', '', '', ''],
                  ['', '', '', '', ''],
                  ['', '', '', '', ''],
                ].map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="border border-gray-200 px-3 py-2 text-xs text-gray-400 h-10">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* SECCIÓN 5 */}
          <Section number="05" title="Base de Datos de Contactos">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 mb-4">
              <p className="text-sm text-emerald-700 font-medium mb-1">¿Tienen una base de datos de clientes/contactos?</p>
              <p className="text-xs text-emerald-600 leading-relaxed">
                El sistema puede importar directamente desde Excel (.xlsx). El archivo debe tener al menos las columnas:
                <strong> Nombre, Email</strong>. Columnas opcionales: Teléfono, Empresa, Cargo, País, Ciudad.
              </p>
            </div>
            <div className="space-y-4">
              <Row label="¿Tienen base de datos existente?" hint="Sí (Excel/CSV) / No / Tengo parte en papel" />
              <Row label="Cantidad aproximada de contactos" />
              <Row label="¿En qué formato está actualmente?" hint="Excel, Outlook, papel, WhatsApp, otro CRM..." />
              <Row label="¿Quieren segmentar por tipo?" hint="Ej: por zona, por servicio activo, por estado de cuenta..." />
            </div>
          </Section>

          {/* SECCIÓN 6 */}
          <Section number="06" title="Preferencias y Notas Adicionales">
            <Row label="¿Hay alguna integración que necesiten desde el inicio?" hint="Ej: WhatsApp, Google Calendar, MercadoPago..." rows={2} />
            <Row label="¿Hay algún proceso o flujo de trabajo específico que el sistema deba contemplar?" rows={3} />
            <Row label="¿Alguna otra aclaración o pedido especial?" rows={2} />
          </Section>

          {/* Firma */}
          <div className="border-t border-gray-100 pt-8">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="h-16 border-b border-gray-300 mb-2" />
                <p className="text-xs text-gray-400">Firma del responsable</p>
              </div>
              <div>
                <div className="h-16 border-b border-gray-300 mb-2" />
                <p className="text-xs text-gray-400">Fecha</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-100 px-10 py-5 flex items-center justify-between">
          <p className="text-xs text-gray-400">Documento preparado por JustCreate · juancruzrossi1@gmail.com</p>
          <p className="text-xs text-gray-400">Versión 1.0 · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b-2 border-indigo-100">
        <span className="text-2xl font-bold text-indigo-200 font-mono leading-none">{number}</span>
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Row({ label, hint, rows = 1 }: { label: string; hint?: string; rows?: number }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
      {rows > 1 ? (
        <div style={{ height: `${rows * 32}px` }} className="w-full border border-gray-200 rounded-lg bg-gray-50/50" />
      ) : (
        <div className="w-full h-9 border border-gray-200 rounded-lg bg-gray-50/50" />
      )}
    </div>
  )
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>
}
