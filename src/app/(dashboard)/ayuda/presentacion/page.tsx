'use client'

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  X, ChevronLeft, ChevronRight, LogIn, Users, TrendingUp, Calculator,
  Mail, CheckSquare, ClipboardList, ShieldCheck, Palette, Server, Lock, Building, HelpCircle,
  Folder, Globe,
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

/* Honest "what this doesn't do yet" callout — same visual language as Callout
   in the standalone docs artifact, kept neutral/informative, not alarming. */
function RoadmapNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 max-w-[62ch] rounded-xl px-4 py-3.5 bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25">
      <span className="block text-[11px] font-bold tracking-[0.06em] uppercase text-amber-700 dark:text-amber-400 mb-1.5">Todavía no hace esto</span>
      <p className="text-[13.5px] text-text-muted leading-relaxed m-0">{children}</p>
    </div>
  )
}

function FixedNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 max-w-[62ch] rounded-xl px-4 py-3.5 bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/25">
      <span className="block text-[11px] font-bold tracking-[0.06em] uppercase text-emerald-700 dark:text-emerald-400 mb-1.5">Recién arreglado</span>
      <p className="text-[13.5px] text-text-muted leading-relaxed m-0">{children}</p>
    </div>
  )
}

function MockTimeline({ empresa, entries }: { empresa: string; entries: { tag: string; text: string; when: string }[] }) {
  return (
    <MockFrame label="Ficha de Empresa">
      <p className="text-[13px] font-bold text-text mb-3">{empresa}</p>
      <div className="space-y-2.5">
        {entries.map((e, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#6366f1' }}>{e.tag} <span className="text-text-subtle font-normal normal-case">· {e.when}</span></p>
              <p className="text-[12.5px] text-text-muted">{e.text}</p>
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

function MockChecklist({ items }: { items: { title: string; done?: boolean; tone: 'neutral' | 'accent' | 'flag' }[] }) {
  return (
    <MockFrame label="Tareas">
      <div className="space-y-2.5">
        {items.map((it) => (
          <div key={it.title} className="flex items-center gap-2.5">
            <span
              className="w-4 h-4 rounded shrink-0 border-2"
              style={it.done ? { background: ACCENT, borderColor: 'transparent' } : { borderColor: 'var(--color-border-strong)' }}
            />
            <span className={`text-[12.5px] flex-1 ${it.done ? 'line-through text-text-subtle' : 'text-text'}`}>{it.title}</span>
            <Pill tone={it.tone}>{it.tone === 'flag' ? 'Urgente' : it.tone === 'accent' ? 'Media' : 'Baja'}</Pill>
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

function MockTicketThread() {
  return (
    <MockFrame label="Ticket #0042 — Falla sensor perimetral">
      <div className="flex items-center gap-2 mb-3.5">
        <Pill tone="flag">En proceso</Pill>
        <Pill tone="neutral">Alta prioridad</Pill>
      </div>
      <div className="space-y-2.5">
        <div className="bg-surface-raised border border-border rounded-lg p-2.5">
          <p className="text-[10.5px] font-bold text-text-subtle mb-1">Cliente</p>
          <p className="text-[12px] text-text">El sensor de la puerta trasera suena solo, sin motivo.</p>
        </div>
        <div className="rounded-lg p-2.5 border" style={{ background: 'rgba(180,83,9,0.08)', borderColor: 'rgba(180,83,9,0.25)' }}>
          <p className="text-[10.5px] font-bold text-amber-700 dark:text-amber-400 mb-1">Nota interna (el cliente no la ve)</p>
          <p className="text-[12px] text-text">Asignado a técnico — probable batería baja del sensor.</p>
        </div>
      </div>
    </MockFrame>
  )
}

function MockWebhookCard() {
  return (
    <MockFrame label="Evento — Charla de seguridad barrial">
      <div className="flex items-center gap-2 mb-2.5 text-text-subtle">
        <Globe size={14} />
        <span className="text-[11px] font-bold uppercase tracking-wide">Webhook de inscripción</span>
      </div>
      <div className="bg-surface-raised border border-border rounded-lg px-3 py-2.5 font-mono text-[11px] text-text-subtle break-all">
        https://crm.justcreate.com.ar/api/webhooks/eventos/evt_8f2·····?secret=••••••••
      </div>
      <p className="text-[11.5px] text-text-subtle mt-2.5">&quot;Integrá este endpoint en tu sitio web o WordPress para registrar inscripciones automáticamente.&quot;</p>
    </MockFrame>
  )
}

function MockFolders() {
  const folders = ['Contratos', 'Manuales técnicos', 'Fotos de instalación', 'Facturas proveedores']
  return (
    <MockFrame label="Documentos">
      <div className="grid grid-cols-2 gap-2.5">
        {folders.map((f) => (
          <div key={f} className="flex items-center gap-2 bg-surface-raised border border-border rounded-lg p-2.5">
            <Folder size={16} style={{ color: '#6366f1' }} className="shrink-0" />
            <span className="text-[12px] text-text font-medium truncate">{f}</span>
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

/* ── slide deck ───────────────────────────────────────────────────────── */

// `vertical` (id de src/lib/verticals.ts, o null) queda disponible para que
// fases futuras (ej. Retainers por horas, Links/Assets — sólo aplican a
// 'marketing') inserten o saquen slides según el rubro de la organización.
// Hoy el recorrido de módulos es el mismo para todos los rubros — no hay
// todavía ningún módulo exclusivo de un rubro que amerite ocultar slides.
function useSlides(vertical: string | null) {
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
      <RoadmapNote>
        Hoy una tarjeta <b>no se puede abrir</b> — solo se arrastra entre columnas. El monto, la probabilidad y quién la lleva se
        ven en la tarjeta, pero la fecha estimada de cierre y las notas se guardan sin mostrarse en ningún lado. No se puede generar
        una cotización directamente desde una oportunidad, ni queda un historial de llamadas/visitas como sí tiene una Empresa.
      </RoadmapNote>
    </Slide>,

    // 16 — Directorio: Empresas
    <Slide key="s16" kicker="Módulo" title="Directorio — Empresas">
      <div className="grid md:grid-cols-[1fr_1.15fr] gap-8 items-center">
        <Bullets items={[
          <>Ficha completa por empresa, con línea de tiempo de <b>notas reales</b>: llamada, reunión, cotización enviada, soporte — con fotos adjuntas.</>,
          <>Historial de todas las cotizaciones mandadas a esa empresa.</>,
          <>Botón <b>&quot;Marcar como cliente&quot;</b> — así es literalmente como una Empresa se convierte en &quot;Cliente&quot;: son la misma ficha, no dos bases separadas.</>,
        ]} />
        <MockTimeline
          empresa="Farmacia del Sol"
          entries={[
            { tag: 'Llamada', text: 'Confirman instalación para el lunes.', when: 'hace 2 días' },
            { tag: 'Cotización', text: 'Enviada — Alarma + CCTV, $400.000.', when: 'hace 5 días' },
          ]}
        />
      </div>
    </Slide>,

    // 17 — Directorio: Contactos
    <Slide key="s17" kicker="Módulo" title="Directorio — Contactos">
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-8 items-center">
        <Bullets items={[
          <>Cada persona vinculada a una empresa: nombre, cargo, mail, teléfono.</>,
          <>Import masivo por Excel, con auto-vinculación por dominio de email o coincidencia de nombre.</>,
        ]} />
        <MockTable
          head={['Contacto', 'Empresa', 'Cargo']}
          rows={[
            ['Marcela Ríos', 'Farmacia del Sol', 'Gerente'],
            ['Julián Paz', 'Cerrajería Norte', 'Dueño'],
          ]}
        />
      </div>
      <RoadmapNote>
        A diferencia de Empresas, un Contacto <b>no tiene ficha propia</b> — hacer click en uno te lleva a la ficha de su empresa,
        no a un detalle del contacto en sí. No tiene notas ni historial propio todavía.
      </RoadmapNote>
    </Slide>,

    // 18 — Cotizador (armar)
    <Slide key="s18" kicker="Módulo" title="Cotizador — armar el presupuesto">
      <Bullets items={[
        <>Se eligen servicios y/o productos del catálogo, y se arma el carrito.</>,
        <>Descuento opcional.</>,
        <>Cada cotización tiene una <b>validez en días</b> — precargada, ajustable caso a caso.</>,
      ]} />
    </Slide>,

    // 19 — Cotizador (PDF y envío)
    <Slide key="s19" kicker="Módulo" title="Cotizador — el PDF y el envío">
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

    // 20 — Cotizaciones
    <Slide key="s20" kicker="Módulo" title="Cotizaciones">
      <p className="text-[15px] text-text-muted mb-5 max-w-[60ch]">El historial de todo lo cotizado, con su estado y reenvío sin rearmar nada.</p>
      <div className="flex flex-wrap gap-2">
        <Pill tone="neutral">Guardada</Pill>
        <Pill tone="accent">Enviada</Pill>
        <Pill tone="accent">Aceptada</Pill>
        <Pill tone="flag">Rechazada</Pill>
        <Pill tone="flag">Vencida</Pill>
      </div>
    </Slide>,

    // 21 — Comunicaciones: campañas
    <Slide key="s21" kicker="Módulo" title="Comunicaciones — campañas de email">
      <Bullets items={[
        <>Asunto, cuerpo y plantillas reutilizables.</>,
        <>Se elige a quién va, de la <b>base de contactos de campaña</b> de la organización.</>,
        <>Envío por tandas — cada destinatario queda marcado como enviado, rebotado o dado de baja.</>,
      ]} />
      <RoadmapNote>
        Ojo: esta base <b>no</b> es la del Directorio — los contactos de Empresas/Directorio hoy no se pueden usar como
        destinatarios de una campaña. Para escribirle a uno, se usa el botón &quot;Enviar Email&quot; puntual desde la ficha de su
        empresa (uno por uno, no una campaña masiva).
      </RoadmapNote>
    </Slide>,

    // 22 — Comunicaciones: lista de bajas
    <Slide key="s22" kicker="Módulo" title="Comunicaciones — lista de bajas">
      <div className="grid md:grid-cols-[1.15fr_1fr] gap-8 items-center">
        <MockTable
          head={['Email', 'Motivo', 'Fecha']}
          rows={[
            ['contacto@viasur.com.ar', <Pill tone="flag">Baja</Pill>, '12/07'],
            ['info@edificiosm.com.ar', <Pill tone="flag">Rebote</Pill>, '08/07'],
          ]}
        />
        <Bullets items={[
          <>Todo email de campaña lleva un link de baja al pie.</>,
          <>Quien lo usa queda excluido de <b>todas</b> las campañas futuras de esa organización, automáticamente.</>,
          <>Un rebote definitivo o una queja de spam hacen exactamente lo mismo, sin que nadie tenga que hacer nada.</>,
        ]} />
      </div>
    </Slide>,

    // 23 — Tareas
    <Slide key="s23" kicker="Módulo" title="Tareas">
      <div className="grid md:grid-cols-[1fr_1.1fr] gap-8 items-center">
        <Bullets items={[
          <>Tres estados: Pendiente, En curso, Hecha. Prioridad Baja/Media/Alta/Urgente, fecha límite, asignada a una persona.</>,
          <>Se puede vincular a una Empresa o Cliente puntual.</>,
          <>Quien la creó ve si el asignado ya la <b>vio</b> o la está trabajando activamente.</>,
        ]} />
        <MockChecklist items={[
          { title: 'Llamar a Depósito Rivas', tone: 'flag' },
          { title: 'Revisar stock de cámaras', done: true, tone: 'neutral' },
          { title: 'Presupuestar ampliación Farmacia del Sol', tone: 'accent' },
        ]} />
      </div>
      <RoadmapNote>
        Sin subtareas, adjuntos ni comentarios. El &quot;visto&quot; es el único aviso que existe — no hay notificación real (ni
        email ni push) cuando te asignan una tarea o cuando se vence; lo de &quot;vencida&quot; se calcula solo en pantalla. Tampoco
        hay vínculo a una oportunidad de Pipeline o a un Ticket.
      </RoadmapNote>
    </Slide>,

    // 24 — Tickets
    <Slide key="s24" kicker="Módulo" title="Tickets">
      <div className="grid md:grid-cols-[1.1fr_1fr] gap-8 items-center">
        <MockTicketThread />
        <Bullets items={[
          <>5 estados reales: Abierto → En proceso → Esperando cliente → Resuelto → Cerrado.</>,
          <>Mensajes internos (solo el equipo) o &quot;públicos&quot;, con reapertura automática si el cliente responde.</>,
          <>Un técnico ve y responde solo <b>sus</b> tickets asignados, y puede marcarlos resueltos.</>,
        ]} />
      </div>
      <RoadmapNote>
        El mensaje &quot;público&quot; hoy <b>no le llega de verdad</b> al cliente por email — es una función a medio terminar. Sin
        adjuntos en los mensajes (no se puede mandar la foto de un sensor roto). Y no existe ningún formulario para que un cliente
        abra un ticket por su cuenta — siempre lo carga el staff.
      </RoadmapNote>
    </Slide>,

    // 25 — Eventos
    <Slide key="s25" kicker="Módulo" title="Eventos">
      <div className="grid md:grid-cols-[1fr_1.15fr] gap-8 items-center">
        <Bullets items={[
          <>Capacitaciones, charlas o cualquier actividad con inscripción.</>,
          <>Alta de inscriptos a mano, o de forma automática por un <b>webhook propio de cada evento</b>.</>,
        ]} />
        <MockWebhookCard />
      </div>
      <FixedNote>
        Justo esta semana arreglamos que este webhook quedara realmente conectado con la web — estaba armado para eso desde antes,
        pero una regla interna lo bloqueaba como si fuera una pantalla privada. Ahora si lo enchufás a un formulario del sitio o de
        WordPress, cada inscripción entra sola al evento.
      </FixedNote>
    </Slide>,

    // 26 — Facturación
    <Slide key="s26" kicker="Módulo" title="Facturación">
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

    // 27 — Documentos
    <Slide key="s27" kicker="Módulo" title="Documentos">
      <div className="grid md:grid-cols-[1fr_1.15fr] gap-8 items-center">
        <Bullets items={[
          <>Carpetas reales, con subcarpetas — no es una lista plana.</>,
          <>Acceso para Super Admin, Admin y Vendedor. Tipos permitidos: imágenes, PDF, Word, Excel y texto, hasta 30MB.</>,
          <>Se puede vincular un documento a un cliente puntual (así es como se adjunta, por ejemplo, la foto de una instalación a la ficha de esa empresa).</>,
        ]} />
        <MockFolders />
      </div>
      <RoadmapNote>
        Sin versionado: volver a subir el mismo archivo crea uno nuevo suelto, no reemplaza al anterior. Las etiquetas son propias
        de cada documento, no hay una lista compartida para buscar por categoría en toda la organización.
      </RoadmapNote>
    </Slide>,

    // 28 — RRHH y asistencia
    <Slide key="s28" kicker="Módulo" title="RRHH y asistencia">
      <div className="grid md:grid-cols-[1fr_1.15fr] gap-8 items-center">
        <Bullets items={[
          <><b>Mi Asistencia</b>: cada persona ficha su entrada y salida — llegar después de las 9:15 marca tardanza sola.</>,
          <><b>Mi Día</b>: vista para técnicos en campo, sin el resto del CRM alrededor.</>,
          <>RRHH ve presentes, ausentes, tardanzas y el % de presentismo de todo el equipo, por mes o por persona.</>,
        ]} />
        <MockTable
          head={['Empleado', 'Estado', 'Hora']}
          rows={[
            ['Roberto Díaz', <Pill tone="good">Presente</Pill>, '08:52'],
            ['Marina Sosa', <Pill tone="flag">Tardanza</Pill>, '09:41'],
            ['Diego Farías', <Pill tone="neutral">Sin registro</Pill>, '—'],
          ]}
        />
      </div>
      <RoadmapNote>
        La pregunta que más importa: <b>si alguien no ficha, hoy no pasa absolutamente nada</b>. No se crea ningún registro para
        ese día, y el % de presentismo se calcula solo sobre los días que sí tienen registro — un día sin fichar no resta, incluso
        puede mostrar un presentismo más alto que el real. No hay ningún aviso automático a RRHH; marcar una ausencia es 100% manual.
      </RoadmapNote>
    </Slide>,

    // 29 — Mi Perfil
    <Slide key="s29" kicker="Módulo" title="Mi Perfil">
      <Bullets items={[
        <>Tema claro u oscuro.</>,
        <>Datos de la cuenta y cambio de contraseña.</>,
      ]} />
    </Slide>,

    // 30 — Divider: administración
    <Divider key="s30" n="Sección 3" title="Para quienes administran" />,

    // 31 — Marca
    <Slide key="s31" kicker="Configuración" title="Marca: dos nombres, dos usos distintos">
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

    // 32 — Correo y SES
    <Slide key="s32" kicker="Configuración" title="Correo: de SMTP a Amazon SES">
      <Bullets items={[
        <>Por defecto: SMTP tradicional (Gmail, Brevo).</>,
        <>Para más volumen y entregabilidad: <b>Amazon SES</b>, con dominio verificado.</>,
        <>Rebotes y quejas de spam se auto-suprimen — nunca se vuelve a mandar a esa dirección.</>,
      ]} />
    </Slide>,

    // 33 — Seguridad
    <Slide key="s33" kicker="Configuración" title="Seguridad de los datos">
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

    // 34 — Panel de la agencia
    <Slide key="s34" kicker="Configuración" title="Panel de la agencia">
      <Bullets items={[
        <>Una capa aparte, exclusiva de JustCreate — ni el Super Admin de la empresa la ve.</>,
        <>Permite suspender o reactivar una organización completa, sin borrar datos.</>,
      ]} />
    </Slide>,

    // 35 — Cierre
    <div key="s35" className="h-full w-full flex flex-col items-center justify-center text-center px-10 text-white" style={{ background: '#0f172a' }}>
      <HelpCircle size={40} className="mb-5 text-white/70" />
      <h1 className="text-[36px] md:text-[48px] font-bold tracking-tight text-balance">¿Preguntas?</h1>
      <p className="text-white/70 text-[16px] mt-4 max-w-[52ch]">Esta guía completa está siempre disponible en Ayuda — con el ícono de arriba en el header.</p>
    </div>,
  ], [vertical])
}

/* ── deck shell ───────────────────────────────────────────────────────── */

export default function PresentacionPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[100] bg-bg" />}>
      <PresentacionDeck />
    </Suspense>
  )
}

function PresentacionDeck() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?first=1&vertical=X — cómo llega acá el wizard de onboarding la primera
  // vez que alguien elige su rubro (ver (auth)/onboarding/page.tsx). En ese
  // caso "salir" tiene que llevar al dashboard, no al índice de Ayuda.
  const isFirstRun = searchParams.get('first') === '1'
  const vertical = searchParams.get('vertical')
  const exitTo = isFirstRun ? '/dashboard' : '/ayuda'
  const slides = useSlides(vertical)
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
      else if (e.key === 'Escape') router.push(exitTo)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, router, exitTo])

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex flex-col">
      {/* progress bar */}
      <div className="h-1 bg-border shrink-0">
        <div className="h-full transition-all duration-200" style={{ width: `${((i + 1) / total) * 100}%`, background: ACCENT }} />
      </div>

      {/* top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <button
          onClick={() => router.push(exitTo)}
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
