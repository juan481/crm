'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, ChevronLeft, ChevronRight, LogIn, Users, TrendingUp, Calculator,
  Mail, CheckSquare, ClipboardList, ShieldCheck, Palette, Server, Lock, Building, HelpCircle,
} from 'lucide-react'

const ACCENT = 'linear-gradient(135deg, #6366f1, #8b5cf6)'

/* ── building blocks ─────────────────────────────────────────────────── */

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-bold tracking-[0.14em] uppercase text-indigo-500 dark:text-indigo-400 mb-3">{children}</p>
}

function Slide({ kicker, title, subtitle, children, center }: { kicker?: string; title: ReactNode; subtitle?: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <div className={`h-full w-full flex flex-col ${center ? 'items-center text-center justify-center' : 'justify-center'} px-10 md:px-20 py-14`}>
      <div className="w-full max-w-[1000px] mx-auto">
        {kicker && <Kicker>{kicker}</Kicker>}
        <h1 className="text-[32px] md:text-[44px] font-bold text-text tracking-tight text-balance leading-[1.1] mb-3">{title}</h1>
        {subtitle && <p className="text-[16px] md:text-[19px] text-text-muted max-w-[62ch] mb-8">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3.5 max-w-[58ch]">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3 text-[16px] md:text-[18px] text-text leading-snug">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

function IconBadge({ icon }: { icon: ReactNode }) {
  return (
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: ACCENT }}>
      {icon}
    </div>
  )
}

function BenefitCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
      <IconBadge icon={icon} />
      <p className="mt-3.5 font-semibold text-text text-[15px]">{title}</p>
      <p className="mt-1 text-[13.5px] text-text-muted leading-relaxed">{body}</p>
    </div>
  )
}

function Pill({ tone, children }: { tone: 'neutral' | 'accent' | 'flag' | 'good'; children: ReactNode }) {
  const cls = {
    neutral: 'bg-surface-raised text-text-subtle border border-border',
    accent:  'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
    flag:    'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    good:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  }[tone]
  return <span className={`inline-block text-[10.5px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{children}</span>
}

/* Faithful illustrative mockups — recreated with real tokens, not real screenshots */

function MockFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl shadow-lg overflow-hidden">
      <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border bg-surface-raised">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2.5 text-[11px] font-semibold text-text-subtle">{label}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function MockDashboard() {
  const stats = [
    { l: 'Clientes Activos', v: '184' },
    { l: 'Ingresos del Mes', v: '$2.4M', up: true },
    { l: 'Pagos Pendientes', v: '7' },
    { l: 'Servicios Vencidos', v: '3' },
  ]
  return (
    <MockFrame label="Dashboard">
      <div className="grid grid-cols-4 gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.l} className="bg-surface-raised rounded-xl p-3 border border-border">
            <p className="text-[10px] text-text-subtle font-semibold uppercase tracking-wide">{s.l}</p>
            <p className="text-[20px] font-bold text-text mt-1">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 h-20 px-1">
        {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%`, background: ACCENT, opacity: 0.35 + i * 0.08 }} />
        ))}
      </div>
    </MockFrame>
  )
}

function MockKanban({ columns }: { columns: { label: string; cards: string[] }[] }) {
  return (
    <MockFrame label="Tablero">
      <div className="flex gap-3 overflow-x-auto">
        {columns.map((c) => (
          <div key={c.label} className="min-w-[140px] flex-1">
            <p className="text-[11px] font-bold text-text-subtle uppercase tracking-wide mb-2">{c.label}</p>
            <div className="space-y-2">
              {c.cards.map((card) => (
                <div key={card} className="bg-surface-raised border border-border rounded-lg p-2.5 text-[12px] text-text font-medium shadow-sm">{card}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

function MockTable({ head, rows }: { head: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <MockFrame label="Listado">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr>{head.map((h) => <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wide text-text-subtle pb-2">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => <td key={j} className="py-2.5 text-text">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </MockFrame>
  )
}

function MockDocument({ label, lines, footer }: { label: string; lines: { l: string; v: string }[]; footer: string }) {
  return (
    <MockFrame label={label}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg" style={{ background: ACCENT }} />
        <div>
          <p className="text-[13px] font-bold text-text">Abba Seguridad</p>
          <p className="text-[10.5px] text-text-subtle">CUIT 30-12345678-9</p>
        </div>
      </div>
      <div className="space-y-1.5 mb-4">
        {lines.map((r) => (
          <div key={r.l} className="flex justify-between text-[12.5px]">
            <span className="text-text-muted">{r.l}</span>
            <span className="text-text font-medium">{r.v}</span>
          </div>
        ))}
      </div>
      <p className="text-[10.5px] text-text-subtle border-t border-border pt-2.5">{footer}</p>
    </MockFrame>
  )
}

function MockGauge({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = Math.min(100, Math.round((used / total) * 100))
  return (
    <MockFrame label="Uso mensual">
      <p className="text-[12.5px] text-text-muted mb-2">{label}</p>
      <div className="h-3 rounded-full bg-surface-raised border border-border overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT }} />
      </div>
      <p className="text-[12px] text-text-subtle mt-2">{used.toLocaleString()} / {total.toLocaleString()} emails — se reinicia en 12 días</p>
    </MockFrame>
  )
}

function RoleSlideBody({ icon, chips, bullets, usage }: { icon: ReactNode; chips: string[]; bullets: ReactNode[]; usage: string }) {
  return (
    <div className="grid md:grid-cols-[auto_1fr] gap-8 items-start">
      <IconBadge icon={icon} />
      <div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {chips.map((c) => <Pill key={c} tone="accent">{c}</Pill>)}
        </div>
        <Bullets items={bullets} />
        <p className="mt-5 text-[13.5px] text-text-subtle italic max-w-[58ch]">{usage}</p>
      </div>
    </div>
  )
}

function Divider({ n, title }: { n: string; title: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center px-10" style={{ background: '#0f172a' }}>
      <p className="text-[15px] font-bold tracking-[0.16em] uppercase text-white/70 mb-4">{n}</p>
      <h1 className="text-[40px] md:text-[56px] font-bold text-white tracking-tight text-balance">{title}</h1>
    </div>
  )
}

/* ── slide deck ───────────────────────────────────────────────────────── */

function useSlides() {
  return useMemo<ReactNode[]>(() => [
    // 1 — Title
    <div key="s1" className="h-full w-full flex flex-col items-center justify-center text-center px-10 text-white" style={{ background: '#0f172a' }}>
      <div className="w-16 h-16 mb-6" style={{ background: ACCENT, clipPath: 'polygon(50% 0%, 100% 22%, 100% 55%, 50% 100%, 0% 55%, 0% 22%)' }} />
      <p className="text-[13px] font-bold tracking-[0.2em] uppercase text-white/60 mb-4">JustCRM · by JustCreate</p>
      <h1 className="text-[46px] md:text-[64px] font-bold tracking-tight text-balance">Cómo funciona el sistema</h1>
      <p className="text-white/70 text-[17px] mt-4 max-w-[52ch]">Una guía para todo el equipo: qué hace cada módulo, y qué le corresponde a cada rol.</p>
    </div>,

    // 2 — Agenda
    <Slide key="s2" kicker="Agenda" title="De qué vamos a hablar">
      <Bullets items={[
        <>Beneficios generales del sistema.</>,
        <>Los <b>5 tipos de usuario</b> y qué puede hacer cada uno.</>,
        <>Recorrido módulo por módulo, con ejemplos.</>,
        <>Configuración y seguridad, para quienes administran.</>,
      ]} />
    </Slide>,

    // 3 — Beneficios
    <Slide key="s3" kicker="Por qué lo usamos" title="Todo el negocio en un solo lugar">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <BenefitCard icon={<Users size={20} />} title="Un solo lugar" body="Clientes, ventas, soporte, facturación y personal en el mismo sistema." />
        <BenefitCard icon={<Calculator size={20} />} title="Cotizaciones profesionales" body="Presupuestos con tu marca, listos en minutos, por email o WhatsApp." />
        <BenefitCard icon={<ShieldCheck size={20} />} title="Cada uno ve lo suyo" body="El sistema muestra solo lo que corresponde según el rol de cada persona." />
        <BenefitCard icon={<Mail size={20} />} title="Comunicación controlada" body="Campañas de email con límite mensual y baja automática al pedirla." />
      </div>
    </Slide>,

    // 4 — Login
    <Slide key="s4" kicker="Primer paso" title="Cómo se entra al sistema">
      <div className="grid md:grid-cols-[1fr_1.1fr] gap-8 items-center">
        <Bullets items={[
          <>Con <b>email y contraseña</b> — no hay registro abierto, un administrador crea el usuario.</>,
          <>Si está activado, hay que resolver un <b>captcha</b> de seguridad antes de entrar.</>,
          <>Si la cuenta está suspendida, el sistema avisa y no deja pasar — no es un error personal.</>,
        ]} />
        <MockFrame label="Iniciar sesión">
          <div className="space-y-2.5">
            <div className="h-9 rounded-lg bg-surface-raised border border-border" />
            <div className="h-9 rounded-lg bg-surface-raised border border-border" />
            <div className="h-9 rounded-lg text-white text-[12px] font-semibold flex items-center justify-center gap-2" style={{ background: ACCENT }}>
              <LogIn size={14} /> Iniciar sesión
            </div>
          </div>
        </MockFrame>
      </div>
    </Slide>,

    // 5 — Divider: tipos de usuario
    <Divider key="s5" n="Sección 1" title="Los 5 tipos de usuario" />,

    // 6 — Overview rolechain
    <Slide key="s6" kicker="Jerarquía" title="Un rol más alto siempre puede hacer lo que hace uno más bajo">
      <div className="flex flex-wrap items-stretch gap-2">
        {[
          { n: 'Super Admin', d: 'todo' },
          { n: 'Admin', d: 'gestión general' },
          { n: 'Vendedor', d: 'clientes y cotizaciones' },
          { n: 'RRHH', d: 'personal' },
          { n: 'Técnico', d: 'su día' },
        ].map((r, i, arr) => (
          <div key={r.n} className="flex items-center gap-2">
            <div className="bg-surface border border-border rounded-xl px-4 py-3 text-center shadow-sm min-w-[110px]">
              <b className="block text-[14px] text-text">{r.n}</b>
              <span className="block text-[11.5px] text-text-subtle mt-0.5">{r.d}</span>
            </div>
            {i < arr.length - 1 && <span className="text-text-subtle">›</span>}
          </div>
        ))}
      </div>
      <p className="mt-6 text-[14px] text-text-muted max-w-[62ch]">Pero en el uso diario, cada rol es más bien una <b>vista distinta</b> del sistema — no todos ven el mismo menú.</p>
    </Slide>,

    // 7 — Super Admin
    <Slide key="s7" kicker="Rol 1 de 5" title="Super Admin">
      <RoleSlideBody
        icon={<ShieldCheck size={22} />}
        chips={['Acceso total', 'Facturación', 'Marca y Plugins', 'Cambia roles']}
        bullets={[
          <>Todo lo que puede hacer un Admin, sin excepciones.</>,
          <>Es el <b>único</b> que puede cambiarle el rol a otra persona.</>,
          <>El único con acceso a Configuración → <b>Marca</b> y <b>Plugins</b>.</>,
          <>Ve la <b>Facturación</b> de la propia organización.</>,
        ]}
        usage="En la práctica: el dueño de la cuenta o quien está a cargo de todo el negocio."
      />
    </Slide>,

    // 8 — Admin
    <Slide key="s8" kicker="Rol 2 de 5" title="Admin">
      <RoleSlideBody
        icon={<Building size={22} />}
        chips={['Usuarios', 'Comunicaciones', 'Servicios/Productos', 'Comercial completo']}
        bullets={[
          <>Crea y edita usuarios — pero <b>no</b> puede cambiarles el rol.</>,
          <>Arma y manda campañas de Comunicaciones.</>,
          <>Mantiene el catálogo de Servicios y Productos.</>,
          <>Visibilidad completa de Clientes, Pipeline, Cotizador y Directorio.</>,
        ]}
        usage="Pensado para quien dirige el equipo comercial u operativo, sin ser el dueño de la cuenta."
      />
    </Slide>,

    // 9 — Vendedor
    <Slide key="s9" kicker="Rol 3 de 5" title="Vendedor">
      <RoleSlideBody
        icon={<TrendingUp size={22} />}
        chips={['Clientes', 'Pipeline', 'Cotizador', 'Directorio']}
        bullets={[
          <>Foco 100% comercial, con libertad total en su terreno.</>,
          <>En Comunicaciones puede <b>ver</b> campañas ya enviadas, pero no crear ni mandar una nueva.</>,
          <>No tiene acceso a Configuración ni a gestión de usuarios.</>,
        ]}
        usage="El rol de todos los días para quien vende: clientes, presupuestos y seguimiento."
      />
    </Slide>,

    // 10 — RRHH
    <Slide key="s10" kicker="Rol 4 de 5" title="RRHH">
      <RoleSlideBody
        icon={<ClipboardList size={22} />}
        chips={['RRHH', 'Mi Asistencia', 'Tareas']}
        bullets={[
          <>Al entrar, va directo a <b>RRHH</b>: asistencia y datos de empleados.</>,
          <>No ve Clientes, Pipeline, Cotizador ni Facturación — no forman parte de su menú.</>,
          <>También tiene Mi Asistencia (para fichar su propio horario) y Tareas.</>,
        ]}
        usage="Vista acotada a personal — el sistema lo redirige si intenta entrar a otra pantalla."
      />
    </Slide>,

    // 11 — Técnico
    <Slide key="s11" kicker="Rol 5 de 5" title="Técnico">
      <RoleSlideBody
        icon={<CheckSquare size={22} />}
        chips={['Mi Día', 'Mi Asistencia', 'Tareas', 'Tickets propios']}
        bullets={[
          <>Entra directo a <b>Mi Día</b>: la agenda de lo asignado para hoy.</>,
          <>Tiene Mi Asistencia, Tareas, y sus propios <b>Tickets</b> (solo los que le asignaron).</>,
          <>El rol más acotado — pensado para usarse desde el celular en el campo.</>,
        ]}
        usage="No ve el resto del CRM alrededor — nada de escritorio administrativo."
      />
    </Slide>,

    // 12 — Divider: módulos
    <Divider key="s12" n="Sección 2" title="Recorrido por los módulos" />,

    // 13 — Dashboard
    <Slide key="s13" kicker="Módulo" title="Dashboard">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-8 items-center">
        <Bullets items={[
          <>Cuatro números clave: Clientes Activos, Ingresos del Mes, Pagos Pendientes y Servicios Vencidos.</>,
          <>Gráfico de ingresos mes a mes y clientes por estado.</>,
          <>Los últimos dos números saltan directo a lo que necesita atención.</>,
        ]} />
        <MockDashboard />
      </div>
    </Slide>,

    // 14 — Clientes
    <Slide key="s14" kicker="Módulo" title="Clientes">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-8 items-center">
        <Bullets items={[
          <>Alta, edición y baja, con filtros y búsqueda.</>,
          <>Importación masiva desde Excel.</>,
          <>Ficha con línea de tiempo de actividad por cliente.</>,
        ]} />
        <MockTable
          head={['Cliente', 'Estado', 'Servicio']}
          rows={[
            ['Farmacia del Sol', <Pill tone="good">Activo</Pill>, 'Alarma + CCTV'],
            ['Cerrajería Norte', <Pill tone="good">Activo</Pill>, 'Monitoreo 24hs'],
            ['Depósito Rivas', <Pill tone="flag">Pendiente</Pill>, 'Instalación'],
          ]}
        />
      </div>
    </Slide>,

    // 15 — Pipeline
    <Slide key="s15" kicker="Módulo" title="Pipeline">
      <p className="text-[15px] text-text-muted mb-5 max-w-[60ch]">Cada oportunidad comercial es una tarjeta que se arrastra entre columnas según su etapa.</p>
      <MockKanban columns={[
        { label: 'Lead', cards: ['Consultorio Méndez'] },
        { label: 'Contactado', cards: ['Edificio San Martín'] },
        { label: 'Propuesta', cards: ['Supermercado Vía'] },
        { label: 'Negociación', cards: ['Colegio Rivadavia'] },
        { label: 'Ganado', cards: ['Farmacia del Sol'] },
      ]} />
    </Slide>,

    // 16 — Cotizador (armar)
    <Slide key="s16" kicker="Módulo" title="Cotizador — armar el presupuesto">
      <Bullets items={[
        <>Se eligen servicios y/o productos del catálogo, y se arma el carrito.</>,
        <>Descuento opcional.</>,
        <>Cada cotización tiene una <b>validez en días</b> — precargada, ajustable caso a caso.</>,
      ]} />
    </Slide>,

    // 17 — Cotizador (PDF y envío)
    <Slide key="s17" kicker="Módulo" title="Cotizador — el PDF y el envío">
      <div className="grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
        <MockDocument
          label="Cotización.pdf"
          lines={[
            { l: 'Alarma perimetral', v: '$180.000' },
            { l: 'Cámaras (x4)', v: '$220.000' },
            { l: 'Monitoreo 24hs / mes', v: '$15.000' },
          ]}
          footer="Cotización realizada con JustCRM, by JustCreate · válida 15 días"
        />
        <Bullets items={[
          <>Logo de la empresa, sin estirar, con acento de marca.</>,
          <>Se manda por <b>email</b> (SMTP o Amazon SES) o por <b>WhatsApp</b> con un resumen listo para pegar.</>,
        ]} />
      </div>
    </Slide>,

    // 18 — Cotizaciones
    <Slide key="s18" kicker="Módulo" title="Cotizaciones">
      <p className="text-[15px] text-text-muted mb-5 max-w-[60ch]">El historial de todo lo cotizado, con su estado y reenvío sin rearmar nada.</p>
      <div className="flex flex-wrap gap-2">
        <Pill tone="neutral">Guardada</Pill>
        <Pill tone="accent">Enviada</Pill>
        <Pill tone="accent">Aceptada</Pill>
        <Pill tone="flag">Rechazada</Pill>
        <Pill tone="flag">Vencida</Pill>
      </div>
    </Slide>,

    // 19 — Directorio
    <Slide key="s19" kicker="Módulo" title="Directorio — Empresas y Contactos">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-8 items-center">
        <Bullets items={[
          <><b>Empresas</b> con las que hay o puede haber relación comercial.</>,
          <><b>Contactos</b>: cada persona vinculada a una empresa.</>,
          <>Import desde Excel con auto-vinculación por dominio de email o nombre.</>,
        ]} />
        <MockTable
          head={['Contacto', 'Empresa', 'Cargo']}
          rows={[
            ['Marcela Ríos', 'Farmacia del Sol', 'Gerente'],
            ['Julián Paz', 'Cerrajería Norte', 'Dueño'],
          ]}
        />
      </div>
    </Slide>,

    // 20 — Comunicaciones
    <Slide key="s20" kicker="Módulo" title="Comunicaciones — campañas de email">
      <Bullets items={[
        <>Asunto, cuerpo y plantillas reutilizables.</>,
        <>Se elige a quién va: Directorio, clientes, o una lista cargada.</>,
        <>Envío por tandas — cada destinatario queda marcado como enviado, rebotado o dado de baja.</>,
      ]} />
    </Slide>,

    // 21 — Límite mensual y bajas
    <Slide key="s21" kicker="Módulo" title="Límite mensual y lista de bajas">
      <div className="grid md:grid-cols-[1.1fr_1fr] gap-8 items-center">
        <MockGauge used={4100} total={12000} label="Emails de campaña + cotizaciones este mes" />
        <Bullets items={[
          <>Al llegar al tope, aparece <b>"Solicitar aumento"</b> por WhatsApp.</>,
          <>Todo email lleva un link de baja — quien lo usa no vuelve a recibir nada de esa organización.</>,
        ]} />
      </div>
    </Slide>,

    // 22 — Tareas y Tickets
    <Slide key="s22" kicker="Módulo" title="Tareas y Tickets">
      <MockKanban columns={[
        { label: 'Tareas', cards: ['Llamar a Depósito Rivas', 'Revisar stock cámaras'] },
        { label: 'Tickets abiertos', cards: ['Falla sensor — Farmacia del Sol', 'Reprogramar clave — Cerrajería'] },
      ]} />
      <p className="mt-5 text-[13.5px] text-text-subtle max-w-[62ch]">Tareas se asignan a una persona con su propio avance; Tickets es soporte al cliente con un hilo de mensajes y un responsable.</p>
    </Slide>,

    // 23 — Eventos
    <Slide key="s23" kicker="Módulo" title="Eventos">
      <Bullets items={[
        <>Capacitaciones, lanzamientos o cualquier actividad con inscripción.</>,
        <>Lista de inscriptos propia por evento — sin planilla aparte.</>,
      ]} />
    </Slide>,

    // 24 — Facturación
    <Slide key="s24" kicker="Módulo" title="Facturación">
      <div className="grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
        <MockDocument
          label="Factura.pdf"
          lines={[
            { l: 'Monitoreo 24hs — Julio', v: '$15.000' },
            { l: 'Mantenimiento preventivo', v: '$8.000' },
          ]}
          footer="Datos fiscales cargados una vez en Configuración → Marca"
        />
        <Bullets items={[
          <>Vista previa con el logo antes de imprimir o descargar.</>,
          <>Los datos fiscales se completan solos en cada factura nueva.</>,
        ]} />
      </div>
    </Slide>,

    // 25 — Documentos
    <Slide key="s25" kicker="Módulo" title="Documentos">
      <Bullets items={[
        <>Subida directa de archivos, organizados en carpetas.</>,
        <>Útil para contratos, manuales o material que el equipo necesite sin buscar en el mail.</>,
      ]} />
    </Slide>,

    // 26 — RRHH y asistencia
    <Slide key="s26" kicker="Módulo" title="RRHH y asistencia">
      <Bullets items={[
        <><b>Mi Asistencia</b>: cada persona ficha su entrada y salida.</>,
        <><b>Mi Día</b>: vista para técnicos en campo, sin el resto del CRM alrededor.</>,
        <>RRHH ve el resumen de presentes, ausentes y tardanzas de todo el equipo.</>,
      ]} />
    </Slide>,

    // 27 — Mi Perfil
    <Slide key="s27" kicker="Módulo" title="Mi Perfil">
      <Bullets items={[
        <>Tema claro u oscuro.</>,
        <>Datos de la cuenta y cambio de contraseña.</>,
      ]} />
    </Slide>,

    // 28 — Divider: administración
    <Divider key="s28" n="Sección 3" title="Para quienes administran" />,

    // 29 — Marca
    <Slide key="s29" kicker="Configuración" title="Marca: dos nombres, dos usos distintos">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <IconBadge icon={<Palette size={20} />} />
          <p className="mt-3.5 font-semibold text-text text-[15px]">Nombre de la marca / empresa</p>
          <p className="mt-1 text-[13.5px] text-text-muted">El que ve el cliente final: cotizaciones, facturas y emails.</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <IconBadge icon={<Server size={20} />} />
          <p className="mt-3.5 font-semibold text-text text-[15px]">Nombre del CRM</p>
          <p className="mt-1 text-[13.5px] text-text-muted">Uso interno — nunca sale en un documento que reciba un cliente.</p>
        </div>
      </div>
    </Slide>,

    // 30 — Correo y SES
    <Slide key="s30" kicker="Configuración" title="Correo: de SMTP a Amazon SES">
      <Bullets items={[
        <>Por defecto: SMTP tradicional (Gmail, Brevo).</>,
        <>Para más volumen y entregabilidad: <b>Amazon SES</b>, con dominio verificado.</>,
        <>Rebotes y quejas de spam se auto-suprimen — nunca se vuelve a mandar a esa dirección.</>,
      ]} />
    </Slide>,

    // 31 — Seguridad
    <Slide key="s31" kicker="Configuración" title="Seguridad de los datos">
      <RoleSlideBody
        icon={<Lock size={22} />}
        chips={['Multi-empresa', 'Row Level Security']}
        bullets={[
          <>Varias organizaciones usan el mismo sistema sin que sus datos se mezclen.</>,
          <>Depende únicamente de <b>con qué cuenta</b> inicia sesión cada persona — no del dominio.</>,
          <>La base de datos tiene seguridad a nivel de fila activada en todas las tablas.</>,
        ]}
        usage="Una segunda barrera, además de la propia lógica del sistema."
      />
    </Slide>,

    // 32 — Panel de la agencia
    <Slide key="s32" kicker="Configuración" title="Panel de la agencia">
      <Bullets items={[
        <>Una capa aparte, exclusiva de JustCreate — ni el Super Admin de la empresa la ve.</>,
        <>Permite suspender o reactivar una organización completa, sin borrar datos.</>,
      ]} />
    </Slide>,

    // 33 — Cierre
    <div key="s33" className="h-full w-full flex flex-col items-center justify-center text-center px-10 text-white" style={{ background: '#0f172a' }}>
      <HelpCircle size={40} className="mb-5 text-white/70" />
      <h1 className="text-[36px] md:text-[48px] font-bold tracking-tight text-balance">¿Preguntas?</h1>
      <p className="text-white/70 text-[16px] mt-4 max-w-[52ch]">Esta guía completa está siempre disponible en Ayuda — con el ícono de arriba en el header.</p>
    </div>,
  ], [])
}

/* ── deck shell ───────────────────────────────────────────────────────── */

export default function PresentacionPage() {
  const router = useRouter()
  const slides = useSlides()
  const [i, setI] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const total = slides.length

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const next = useCallback(() => setI((v) => Math.min(total - 1, v + 1)), [total])
  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key === 'Escape') router.push('/ayuda')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, router])

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex flex-col">
      {/* progress bar */}
      <div className="h-1 bg-border shrink-0">
        <div className="h-full transition-all duration-200" style={{ width: `${((i + 1) / total) * 100}%`, background: ACCENT }} />
      </div>

      {/* top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <button
          onClick={() => router.push('/ayuda')}
          className="p-2 rounded-xl transition-all hover:bg-[var(--color-surface-raised)]"
          style={{ color: 'var(--color-text-muted)' }}
          title="Salir (Esc)"
        >
          <X size={18} />
        </button>
        <span className="text-[12.5px] font-semibold text-text-subtle tabular-nums">{i + 1} / {total}</span>
      </div>

      {/* slide */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div key={i} className={`w-full h-full ${reducedMotion ? '' : 'animate-slide-right'}`}>
          {slides[i]}
        </div>
      </div>

      {/* nav */}
      <div className="flex items-center justify-center gap-3 pb-6 shrink-0">
        <button
          onClick={prev}
          disabled={i === 0}
          className="p-2.5 rounded-full border border-border bg-surface disabled:opacity-30 transition-all hover:bg-[var(--color-surface-raised)]"
          style={{ color: 'var(--color-text)' }}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={next}
          disabled={i === total - 1}
          className="p-2.5 rounded-full border border-border bg-surface disabled:opacity-30 transition-all hover:bg-[var(--color-surface-raised)]"
          style={{ color: 'var(--color-text)' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
