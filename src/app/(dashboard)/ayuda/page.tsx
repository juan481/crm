'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'equipo' | 'admin'

const num =
  'text-[11px] font-bold tracking-[0.08em] uppercase text-indigo-600 dark:text-indigo-400 mb-1.5'

function Section({ id, n, title, lede, children }: { id: string; n: number; title: string; lede: string; children?: ReactNode }) {
  return (
    <section id={id} className="py-8 border-t border-border first:border-t-0 first:pt-0">
      <p className={num}>{n} — {title}</p>
      <h2 className="text-[20px] font-semibold text-text mb-1 tracking-tight text-balance">{lede}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 max-w-[66ch] text-[14.5px] leading-relaxed text-text-muted">{children}</p>
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-[15px] font-semibold text-text mt-5 mb-2">{children}</h3>
}

function Toc({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="bg-surface border border-border rounded-2xl p-2 my-6 shadow-sm">
      <ol className="columns-1 sm:columns-2 gap-1 list-none m-0 p-0">
        {items.map((item, i) => (
          <li key={item.id} className="break-inside-avoid">
            <a
              href={`#${item.id}`}
              className="flex items-baseline gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-semibold text-text-muted no-underline hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 transition-colors"
            >
              <span className="w-4 shrink-0 text-[13px] font-bold text-indigo-600 dark:text-indigo-400">{i + 1}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function RoleChain({ roles }: { roles: { name: string; note?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 my-4">
      {roles.map((r, i) => (
        <div key={r.name} className="flex items-center gap-2">
          <div className="flex-1 min-w-[100px] bg-surface border border-border rounded-xl px-3.5 py-3 shadow-sm text-center">
            <b className="block text-[13.5px] text-text">{r.name}</b>
            {r.note && <span className="block text-[12px] text-text-subtle mt-0.5">{r.note}</span>}
          </div>
          {i < roles.length - 1 && <span className="text-text-subtle text-[15px]">›</span>}
        </div>
      ))}
    </div>
  )
}

function FieldTable({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto my-4 border border-border rounded-2xl shadow-sm">
      <table className="w-full border-collapse text-[13.5px] bg-surface">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="text-left text-[11px] font-bold tracking-[0.06em] uppercase text-text-subtle bg-surface-raised px-3.5 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b], i) => (
            <tr key={i}>
              <td className="px-3.5 py-2.5 border-t border-border text-text font-semibold whitespace-nowrap align-top">{a}</td>
              <td className="px-3.5 py-2.5 border-t border-border text-text-muted align-top">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Callout({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3.5 my-4 bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25">
      <span className="block text-[11px] font-bold tracking-[0.06em] uppercase text-amber-700 dark:text-amber-400 mb-1.5">{tag}</span>
      <p className="text-[14px] text-text-muted m-0">{children}</p>
    </div>
  )
}

function Note({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3.5 my-4 bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/25">
      <span className="block text-[11px] font-bold tracking-[0.06em] uppercase text-indigo-600 dark:text-indigo-400 mb-1.5">{tag}</span>
      <p className="text-[14px] text-text-muted m-0">{children}</p>
    </div>
  )
}

function Pill({ tone, children }: { tone: 'neutral' | 'accent' | 'flag'; children: ReactNode }) {
  const cls = {
    neutral: 'bg-surface-raised text-text-subtle border border-border',
    accent:  'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
    flag:    'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  }[tone]
  return <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full mr-1 mb-1 ${cls}`}>{children}</span>
}

function Path({ letter, title, when, steps }: { letter: string; title: string; when?: string; steps: ReactNode[] }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 my-4 shadow-sm">
      <div className="flex items-baseline gap-2.5 mb-1">
        <span className="font-bold text-[17px] text-indigo-600 dark:text-indigo-400">{letter}</span>
        <h3 className="m-0 text-[15.5px] font-bold text-text">{title}</h3>
      </div>
      {when && <p className="text-[13.5px] text-text-subtle mt-0 mb-3.5">{when}</p>}
      <ol className="m-0 p-0 list-none">
        {steps.map((s, i) => (
          <li key={i} className="relative pl-9 mb-3 last:mb-0 text-[14.5px] text-text-muted">
            <span className="absolute left-0 -top-px w-[22px] h-[22px] rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 text-[12px] font-bold flex items-center justify-center">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Compare({ oldTitle, oldPoints, newTitle, newPoints }: { oldTitle: string; oldPoints: string[]; newTitle: string; newPoints: string[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3.5 my-5">
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
        <span className="inline-block text-[11px] font-bold tracking-[0.06em] uppercase px-2.5 py-0.5 rounded-full mb-3 bg-surface-raised text-text-subtle">{oldTitle}</span>
        {oldPoints.map((p) => <p key={p} className="text-[13.5px] text-text-muted m-0 mb-1.5 last:mb-0">{p}</p>)}
      </div>
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
        <span className="inline-block text-[11px] font-bold tracking-[0.06em] uppercase px-2.5 py-0.5 rounded-full mb-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">{newTitle}</span>
        {newPoints.map((p) => <p key={p} className="text-[13.5px] text-text-muted m-0 mb-1.5 last:mb-0">{p}</p>)}
      </div>
    </div>
  )
}

const TOC_EQUIPO = [
  { id: 'e1', label: 'Ingresar al sistema' },
  { id: 'e2', label: 'Tipos de usuario' },
  { id: 'e3', label: 'Dashboard' },
  { id: 'e4', label: 'Clientes' },
  { id: 'e5', label: 'Pipeline' },
  { id: 'e6', label: 'Cotizador' },
  { id: 'e7', label: 'Cotizaciones' },
  { id: 'e8', label: 'Directorio' },
  { id: 'e9', label: 'Comunicaciones' },
  { id: 'e10', label: 'Tareas y Tickets' },
  { id: 'e11', label: 'Eventos' },
  { id: 'e12', label: 'Facturación' },
  { id: 'e13', label: 'Documentos' },
  { id: 'e14', label: 'RRHH y asistencia' },
  { id: 'e15', label: 'Mi Perfil' },
]

const TOC_ADMIN = [
  { id: 'a1', label: 'Roles y permisos' },
  { id: 'a2', label: 'Gestión de usuarios' },
  { id: 'a3', label: 'Marca' },
  { id: 'a4', label: 'Correo y Amazon SES' },
  { id: 'a5', label: 'Servicios y Productos' },
  { id: 'a6', label: 'Plugins' },
  { id: 'a7', label: 'Seguridad de los datos' },
  { id: 'a8', label: 'Panel de la agencia' },
]

export default function AyudaPage() {
  const [tab, setTab] = useState<Tab>('equipo')

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 flex gap-1.5 px-4 lg:px-6 pt-4 pb-2.5 bg-bg border-b border-border">
        <button
          onClick={() => setTab('equipo')}
          className={`flex-1 max-w-[220px] text-center px-4 py-2.5 rounded-xl text-[13.5px] font-bold transition-all ${
            tab === 'equipo'
              ? 'text-white bg-gradient-to-br from-indigo-500 to-violet-500'
              : 'text-text-subtle bg-surface border border-border'
          }`}
        >
          Para el equipo
        </button>
        <button
          onClick={() => setTab('admin')}
          className={`flex-1 max-w-[220px] text-center px-4 py-2.5 rounded-xl text-[13.5px] font-bold transition-all ${
            tab === 'admin'
              ? 'text-white bg-gradient-to-br from-indigo-500 to-violet-500'
              : 'text-text-subtle bg-surface border border-border'
          }`}
        >
          Para Administradores
        </button>
      </div>

      <div className="max-w-[780px] mx-auto px-4 lg:px-6 pt-6 pb-24">
        <header className="flex items-start gap-3.5 mb-2">
          <div
            className="shrink-0 w-9 h-9 mt-1"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              clipPath: 'polygon(50% 0%, 100% 22%, 100% 55%, 50% 100%, 0% 55%, 0% 22%)',
            }}
          />
          <div>
            <p className="text-[12px] font-bold tracking-[0.09em] uppercase text-text-subtle m-0 mb-1.5">JustCRM · by JustCreate</p>
            <h1 className="text-[28px] font-bold text-text m-0 tracking-tight text-balance">Documentación del sistema</h1>
          </div>
        </header>
        <p className="max-w-[62ch] text-[16px] text-text-muted mb-6">
          Cómo funciona el CRM, explicado en simple — como parte del equipo que lo usa día a día, y como quien lo administra.
          Elegí arriba la pestaña que corresponda; cada una tiene su propio índice para ir directo a lo que necesitás.
        </p>

        {tab === 'equipo' ? (
          <div>
            <Toc items={TOC_EQUIPO} />

            <Section id="e1" n={1} title="Ingresar al sistema" lede="Cómo se entra, y qué pasa si algo bloquea el acceso.">
              <P>
                Se entra con <b>email y contraseña</b> desde la pantalla de login — no hay registro abierto, un administrador crea tu
                usuario de antemano. Si el sistema tiene el captcha de seguridad activado (Cloudflare Turnstile), vas a tener que
                resolverlo antes de que se habilite el botón de ingresar.
              </P>
              <Callout tag='Si ves "Cuenta suspendida"'>
                Significa que la organización completa fue suspendida por la agencia (JustCreate) — típicamente por un tema
                administrativo o de pago. No es un error tuyo ni de tu contraseña: escribí a <b>contacto@justcreate.com.ar</b> para
                resolverlo. Ningún dato se pierde mientras tanto.
              </Callout>
            </Section>

            <Section id="e2" n={2} title="Tipos de usuario" lede="Cinco roles, cada uno con su propia vista del sistema.">
              <P>
                Todos entran por el mismo login — lo que cada persona ve y puede tocar depende únicamente de su rol. No es solo una
                cuestión de botones ocultos: <b>RRHH</b> y <b>Técnico</b> ni siquiera llegan al menú completo, el sistema los lleva
                directo a su propia vista reducida y los redirige de vuelta si intentan entrar a otra pantalla a mano.
              </P>
              <RoleChain
                roles={[
                  { name: 'Super Admin', note: 'todo, incluida facturación' },
                  { name: 'Admin', note: 'gestión general' },
                  { name: 'Vendedor', note: 'clientes y cotizaciones' },
                  { name: 'RRHH', note: 'personal y asistencia' },
                  { name: 'Técnico', note: 'solo su día' },
                ]}
              />
              <P>
                Un rol más alto siempre puede hacer lo que puede hacer uno más bajo, nunca al revés — esa es la jerarquía de permisos.
                Pero en el uso diario, cada rol es más bien una vista distinta y acotada del sistema:
              </P>

              <H3>Super Admin</H3>
              <P>
                Acceso total, sin ninguna pantalla oculta. Además de todo lo que puede hacer un Admin, es el <b>único</b> rol que puede
                cambiarle el rol a otra persona, entrar a Configuración → Marca y Plugins, y ver la Facturación de la propia
                organización. Es, además, el único rol al que la agencia (JustCreate) le puede llegar a dar acceso al panel de
                agencia — algo aparte y superior a este rol, ver sección 8 de Administradores. En la práctica, suele ser el dueño de
                la cuenta o quien está a cargo de todo el negocio.
              </P>

              <H3>Admin</H3>
              <P>
                Gestión general del día a día, sin tocar la configuración de marca ni la facturación de la organización. Crea y edita
                usuarios (pero no puede cambiarles el rol), arma y manda campañas en Comunicaciones, mantiene el catálogo de
                Servicios y Productos, y tiene visibilidad completa de Clientes, Pipeline, Cotizador y Directorio. Pensado para quien
                dirige el equipo comercial u operativo sin ser el dueño de la cuenta.
              </P>

              <H3>Vendedor</H3>
              <P>
                Foco 100% comercial: Clientes, Pipeline, Cotizador, Cotizaciones y Directorio, con libertad total ahí. En
                Comunicaciones puede ver el historial de campañas ya enviadas, pero no crear ni mandar una nueva — eso queda
                reservado a Admin o Super Admin. No tiene acceso a Configuración, al catálogo de Servicios/Productos ni a la
                gestión de usuarios.
              </P>

              <H3>RRHH</H3>
              <P>
                Vista acotada a personal: al entrar, el sistema lo lleva directo a <b>RRHH</b>, donde gestiona asistencia y datos de
                los empleados. También tiene <b>Mi Asistencia</b> (para fichar su propio horario) y <b>Tareas</b>. No ve Clientes,
                Pipeline, Cotizador, Facturación ni el resto de los módulos comerciales — no es que estén ocultos con un candado
                visual, directamente no forman parte de su menú.
              </P>

              <H3>Técnico</H3>
              <P>
                El rol más acotado de todos: entra directo a <b>Mi Día</b>, la agenda de lo que tiene asignado para hoy, sin el resto
                del CRM alrededor. Además tiene <b>Mi Asistencia</b> para fichar entrada/salida, <b>Tareas</b>, y <b>Tickets</b> —
                acá ve únicamente los reclamos o pedidos de soporte que tiene asignados, no los del resto del equipo. Pensado para
                usarse desde el celular en el campo, no desde un escritorio administrativo.
              </P>

              <FieldTable
                head={['Rol', 'Qué puede hacer']}
                rows={[
                  ['Super Admin', 'Todo — incluye Facturación, Marca, Plugins y cambiar el rol de cualquier persona.'],
                  ['Admin', 'Gestión general: usuarios (sin cambiar roles), Comunicaciones, Servicios/Productos, Clientes, Pipeline, Cotizador.'],
                  ['Vendedor', 'Clientes, Pipeline, Cotizador, Directorio. Ve las campañas de Comunicaciones pero no las crea.'],
                  ['RRHH', 'Solo RRHH, Mi Asistencia y Tareas — sin acceso a los módulos comerciales.'],
                  ['Técnico', 'Mi Día, Mi Asistencia, Tareas y sus propios Tickets — pensado para uso en campo.'],
                ]}
              />
            </Section>

            <Section id="e3" n={3} title="Dashboard" lede="El estado del negocio de un vistazo.">
              <P>
                Cuatro números arriba de todo: <b>Clientes Activos</b>, <b>Ingresos del Mes</b> (con la tendencia respecto al mes
                anterior), <b>Pagos Pendientes</b> y <b>Servicios Vencidos</b> — los últimos dos están para saltar directo a lo que
                necesita atención. Debajo, un gráfico de ingresos mes a mes y otro de clientes agrupados por estado, más un contador
                de clientes nuevos del mes.
              </P>
            </Section>

            <Section id="e4" n={4} title="Clientes" lede="La base de clientes, con su actividad e historial.">
              <P>
                Alta, edición y baja de clientes, con filtros por estado y búsqueda. Se puede importar una base existente desde
                Excel de una sola vez. Cada cliente tiene su propia ficha con línea de tiempo de actividad, y el tipo de servicio se
                elige de una lista que se completa sola a medida que se van cargando distintos tipos entre todos los clientes.
              </P>
            </Section>

            <Section id="e5" n={5} title="Pipeline" lede="Oportunidades comerciales, en formato tablero.">
              <P>Cada oportunidad es una tarjeta que se arrastra entre columnas según su etapa:</P>
              <RoleChain roles={[{ name: 'Lead' }, { name: 'Contactado' }, { name: 'Propuesta' }, { name: 'Negociación' }, { name: 'Ganado', note: 'o Perdido' }]} />
            </Section>

            <Section id="e6" n={6} title="Cotizador" lede="Armar y mandar un presupuesto en minutos.">
              <P>
                Se eligen servicios y/o productos del catálogo, se arma el carrito, y opcionalmente se aplica un descuento. Cada
                cotización tiene una <b>validez en días</b> — viene precargada con el valor por defecto de la organización, pero se
                puede ajustar para ese presupuesto puntual antes de mandarlo; el PDF muestra directamente la frase &quot;Cotización
                válida por N días luego de su emisión&quot; con la fecha de vencimiento.
              </P>
              <H3>El PDF</H3>
              <P>
                Header con el logo de la empresa (se ajusta manteniendo su proporción real, sin estirarlo, sea cual sea el formato
                del archivo original) y un acento diagonal del color de marca de la organización. Al pie, un crédito fijo:
                &quot;Cotización realizada con JustCRM, by JustCreate&quot;, con link a justcreate.com.ar.
              </P>
              <H3>Cómo se envía</H3>
              <P>
                Dos caminos, no excluyentes: por <b>email</b> (usa la configuración de correo de la organización — SMTP o Amazon
                SES, ver sección 4 de Administradores) con el PDF adjunto, o por <b>WhatsApp</b> con un resumen de texto del
                presupuesto listo para pegar en una conversación.
              </P>
            </Section>

            <Section id="e7" n={7} title="Cotizaciones" lede="El historial de todo lo cotizado.">
              <P>
                Cada cotización guarda su estado — <Pill tone="neutral">Guardada</Pill><Pill tone="accent">Enviada</Pill>
                <Pill tone="accent">Aceptada</Pill><Pill tone="flag">Rechazada</Pill><Pill tone="flag">Vencida</Pill> — y desde el
                detalle se puede reenviar el mismo PDF sin tener que rearmar nada.
              </P>
            </Section>

            <Section id="e8" n={8} title="Directorio" lede="Empresas y las personas de contacto dentro de cada una.">
              <P>
                Además de la base de Clientes, el Directorio guarda <b>Empresas</b> (organizaciones con las que hay o puede haber
                relación comercial) y sus <b>Contactos</b> — cada persona vinculada a una empresa, con cargo, email y teléfono. Al
                importar contactos desde Excel, el sistema intenta vincular automáticamente cada uno a su empresa por el dominio del
                email o por coincidencia de nombre, así no hay que enlazarlos a mano uno por uno.
              </P>
              <FieldTable
                head={['Columna del Excel', 'Obligatoria']}
                rows={[
                  ['Nombre', 'Sí'],
                  ['Apellido', 'Sí'],
                  ['Empresa', 'No — si no existe, el contacto igual se guarda sin vincular'],
                  ['Cargo', 'No'],
                  ['Mail', 'No, pero es lo que se necesita para poder escribirle'],
                  ['Teléfono', 'No'],
                ]}
              />
            </Section>

            <Section id="e9" n={9} title="Comunicaciones" lede="Campañas de email a listas propias, con freno de seguridad incluido.">
              <P>
                Se arma una campaña (asunto, cuerpo, con plantillas reutilizables) y se elige a quién va: contactos del Directorio,
                clientes, o una lista cargada directamente. El envío es por tandas para no saturar nada, y cada destinatario queda
                marcado como enviado, rebotado o dado de baja.
              </P>
              <H3>Límite mensual</H3>
              <P>
                Cada organización tiene un tope de emails de campaña por mes (no afecta cotizaciones ni mensajes puntuales a
                contactos, que no tienen límite). Se ve una barra de uso arriba de la sección, con aviso de cuándo se reinicia. Al
                llegar al tope, no se pueden mandar más campañas hasta el mes siguiente — aparece un botón <b>&quot;Solicitar
                aumento&quot;</b> que abre WhatsApp directo con la agencia.
              </P>
              <H3>Lista de bajas</H3>
              <P>
                Todo email de campaña lleva un link de &quot;darse de baja&quot; al pie. Quien lo usa queda excluido de <b>todas</b>{' '}
                las campañas futuras de esa organización — la lista completa de quién se dio de baja, con buscador, está en el
                botón &quot;Bajas&quot; de esta misma sección.
              </P>
            </Section>

            <Section id="e10" n={10} title="Tareas y Tickets" lede="Lo que hay que hacer, y lo que un cliente pidió que se resuelva.">
              <P>
                <b>Tareas</b> se asignan a una persona del equipo y tienen su propio estado de avance. <b>Tickets</b> es soporte al
                cliente propiamente dicho: cada ticket tiene un hilo de mensajes y un responsable asignado, para no perder el hilo
                de una consulta o reclamo.
              </P>
            </Section>

            <Section id="e11" n={11} title="Eventos" lede="Capacitaciones, lanzamientos o cualquier actividad con inscripción.">
              <P>Cada evento lleva su propia lista de inscriptos, para saber quién confirmó asistencia sin tener que llevarlo aparte en una planilla.</P>
            </Section>

            <Section id="e12" n={12} title="Facturación" lede="Facturas con los datos fiscales de la organización.">
              <P>
                Vista previa con el logo de la empresa antes de imprimir o descargar en PDF. Los datos de facturación (dirección
                fiscal, CUIT, instrucciones de pago) se cargan una sola vez en Configuración → Marca y se completan solos en cada
                factura nueva.
              </P>
            </Section>

            <Section id="e13" n={13} title="Documentos" lede="Un lugar central para archivos, ordenados en carpetas.">
              <P>
                Subida directa de cualquier archivo, organizado en carpetas — útil para contratos, manuales o cualquier material que
                el equipo necesite encontrar rápido sin buscar en el mail.
              </P>
            </Section>

            <Section id="e14" n={14} title="RRHH y asistencia" lede="Fichado de entrada/salida y la vista del día para técnicos.">
              <P>
                <b>Mi Asistencia</b> es donde cada persona ficha su entrada y salida. <b>Mi Día</b> es la vista pensada para técnicos
                en campo: lo que tienen asignado para hoy, sin el resto del CRM alrededor distrayendo.
              </P>
            </Section>

            <Section id="e15" n={15} title="Mi Perfil" lede="Tus datos y preferencias.">
              <P>Tema claro u oscuro (esta misma documentación respeta esa preferencia), datos de tu cuenta, y cambio de contraseña.</P>
            </Section>

            <footer className="mt-11 pt-4.5 border-t border-border text-[12.5px] text-text-subtle">
              JustCRM — documentación de uso. Cambiá a &quot;Para Administradores&quot; arriba si necesitás configurar o gestionar el sistema.
            </footer>
          </div>
        ) : (
          <div>
            <Toc items={TOC_ADMIN} />

            <Section id="a1" n={1} title="Roles y permisos" lede="Quién puede hacer qué, dentro de tu organización.">
              <P>Cada persona tiene un único rol, de mayor a menor alcance:</P>
              <RoleChain
                roles={[
                  { name: 'Super Admin', note: 'todo, incluida facturación' },
                  { name: 'Admin', note: 'gestión general' },
                  { name: 'Vendedor', note: 'clientes y cotizaciones' },
                  { name: 'RRHH' },
                  { name: 'Técnico', note: 'solo su día' },
                ]}
              />
              <P>
                Un rol más alto siempre puede hacer lo que puede hacer uno más bajo, nunca al revés. Solo <b>Super Admin</b> puede
                cambiarle el rol a otra persona o tocar Marca y Plugins. El detalle función-por-función de cada rol está en la
                sección 2 de &quot;Para el equipo&quot;.
              </P>
            </Section>

            <Section id="a2" n={2} title="Gestión de usuarios" lede="Alta, baja y permisos de tu equipo.">
              <Path letter="A" title="Crear un usuario" steps={[
                <>Nombre, email y una <b>contraseña temporal</b> (mínimo 8 caracteres).</>,
                <>Elegís el rol inicial — se puede cambiar después.</>,
              ]} />
              <Path letter="B" title="Cambiar privilegios" when="Solo visible para Super Admin." steps={[
                <>Ícono de escudo al lado de la persona → elegís el nuevo rol de la lista.</>,
                <>Se aplica al instante, sin que la persona tenga que volver a iniciar sesión.</>,
              ]} />
              <Path letter="C" title="Suspender o reactivar" when="Para alguien que deja el equipo temporalmente, sin borrar su historial." steps={[
                <>Ícono de bloqueo → confirmar.</>,
                <>La persona no puede volver a entrar hasta que se la reactive de la misma forma.</>,
              ]} />
            </Section>

            <Section id="a3" n={3} title="Marca" lede="Cómo se ve tu empresa en lo que reciben tus clientes.">
              <P>Dos campos que a veces se confunden porque suenan parecido, pero son cosas distintas:</P>
              <FieldTable
                head={['Campo', 'Para qué es']}
                rows={[
                  ['Nombre de la marca / empresa', 'El que ve tu cliente final: aparece en cotizaciones, facturas y emails que se mandan afuera.'],
                  ['Nombre del CRM', 'Uso interno — el nombre que ve tu propio equipo dentro del sistema (menú, título de la pestaña del navegador). Nunca sale en un documento que reciba un cliente.'],
                ]}
              />
              <P>
                Acá también se cargan el logo, los colores de marca, y la <b>validez por defecto de las cotizaciones</b> (en días) —
                el valor con el que arranca cada cotización nueva antes de ajustarlo caso por caso.
              </P>
            </Section>

            <Section id="a4" n={4} title="Correo y Amazon SES" lede="Cómo sale el correo del sistema, y cómo se pasa a un proveedor serio.">
              <P>
                Por defecto el sistema manda correo por SMTP tradicional (Gmail, Brevo, etc.). Para volumen más alto o mejor
                entregabilidad, se puede pasar a <b>Amazon SES</b>.
              </P>
              <Compare
                oldTitle="SMTP / Brevo"
                oldPoints={['Rápido de configurar.', 'Límites de envío más bajos.', 'Sin seguimiento de rebotes/aperturas.']}
                newTitle="Amazon SES"
                newPoints={['Requiere verificar el dominio propio (DKIM).', 'Volumen alto, mejor entregabilidad.', 'Rebotes, quejas y aperturas se registran solos.']}
              />
              <p className="text-[13px] text-text-subtle text-center -mt-1 mb-2">
                Se elige por organización, desde Configuración → Correo — hay un checklist paso a paso ahí mismo.
              </p>
              <Note tag="Sobre el límite mensual de campañas">
                El tope que se ve en Comunicaciones (sección 9 de &quot;Para el equipo&quot;) <b>no se puede subir desde ninguna
                pantalla</b> — es a propósito, para que ninguna organización pueda sacarse su propio techo de gasto. Lo sube la
                agencia (JustCreate) cuando llega el pedido por WhatsApp.
              </Note>
            </Section>

            <Section id="a5" n={5} title="Servicios y Productos" lede="El catálogo que alimenta al Cotizador.">
              <P>
                Todo lo que se puede cotizar sale de acá: servicios (con su ciclo de facturación) y productos (con su unidad de
                venta). Mantenerlo actualizado es lo que hace que armar una cotización nueva sea elegir de una lista, no escribir
                todo a mano cada vez.
              </P>
            </Section>

            <Section id="a6" n={6} title="Plugins" lede="Funciones opcionales, activables por organización.">
              <P>
                Algunas funciones del CRM (como analíticas avanzadas en el Dashboard) están detrás de un interruptor por
                organización, en vez de estar siempre prendidas para todo el mundo.
              </P>
            </Section>

            <Section id="a7" n={7} title="Seguridad de los datos" lede="Cada organización ve solo lo suyo — siempre, sin excepción.">
              <P>
                El CRM es <b>multi-empresa</b>: varias organizaciones distintas pueden usar el mismo sistema, en el mismo link, sin
                que los datos se mezclen entre ellas. Esto no depende de qué dominio o subdominio se use para entrar — depende
                únicamente de <b>con qué cuenta inicia sesión cada persona</b>. Además, la base de datos tiene seguridad a nivel de
                fila (Row Level Security) activada en todas las tablas, como una segunda barrera además de la propia lógica del
                sistema.
              </P>
            </Section>

            <Section id="a8" n={8} title="Panel de la agencia" lede="Una capa más arriba de Super Admin — exclusiva de JustCreate.">
              <P>
                Existe un panel separado, en <code>/admin</code>, que <b>no es parte de ninguna organización</b> — ni siquiera el
                Super Admin de tu empresa puede verlo. Es donde la agencia gestiona todas las organizaciones que corren sobre este
                mismo CRM.
              </P>
              <Callout tag="Suspender una organización">
                Desde ese panel, la agencia puede suspender una organización completa (por ejemplo, por falta de pago) — bloquea el
                login de <b>todos</b> sus usuarios al instante, sin borrar ningún dato. Al reactivarla, todo sigue exactamente donde
                estaba. El acceso a este panel no se otorga desde ninguna pantalla: lo habilita la agencia manualmente, solo para su
                propia cuenta.
              </Callout>
            </Section>

            <footer className="mt-11 pt-4.5 border-t border-border text-[12.5px] text-text-subtle">
              JustCRM — documentación de administración · by{' '}
              <a href="https://justcreate.com.ar" target="_blank" rel="noopener noreferrer" className="underline">
                JustCreate
              </a>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
