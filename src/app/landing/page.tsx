'use client'

import { FormEvent, ReactNode, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CloudCog,
  FileCheck2,
  FileText,
  Gauge,
  Headphones,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MousePointerClick,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Send,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  UserCog,
  Users,
  Warehouse,
  X,
  Zap,
} from 'lucide-react'
import styles from './landing.module.css'

type IconType = typeof MessageCircle

type Capability = {
  eyebrow: string
  title: string
  description: string
  icon: IconType
  items: string[]
  accent: 'cyan' | 'blue' | 'violet' | 'amber' | 'emerald' | 'slate'
}

const capabilities: Capability[] = [
  {
    eyebrow: 'Ventas',
    title: 'Del primer contacto al cierre',
    description: 'Unificá la relación comercial y mantené cada oportunidad visible para todo el equipo autorizado.',
    icon: TrendingUp,
    items: ['Empresas, contactos y clientes', 'Pipeline, objetivos y forecast', 'Cotizador, kits y PDFs profesionales', 'Catálogo en ARS y USD'],
    accent: 'cyan',
  },
  {
    eyebrow: 'Comunicación',
    title: 'WhatsApp y envíos masivos',
    description: 'Atendé consultas, nutrí tu base y medí cada interacción sin perder el historial.',
    icon: Mail,
    items: ['Bandeja compartida de WhatsApp', 'Campañas masivas por email', 'Aperturas, clics, rebotes y bajas', 'Plantillas y variables personalizadas'],
    accent: 'blue',
  },
  {
    eyebrow: 'Operación',
    title: 'El trabajo después de vender',
    description: 'Convertí una venta en tareas concretas, responsables claros y seguimiento de campo.',
    icon: CalendarCheck,
    items: ['Tareas, eventos y agenda', 'Mi Día para equipos técnicos', 'Tickets, SLA y postventa', 'Asistencia y geolocalización'],
    accent: 'violet',
  },
  {
    eyebrow: 'Inventario',
    title: 'Stock, compras y entregas',
    description: 'Controlá materiales, costos y movimientos desde el ingreso del proveedor hasta la entrega.',
    icon: Warehouse,
    items: ['Stock, reservas y mínimos', 'Compras y cuentas por pagar', 'OCR de facturas con IA', 'Remitos y trazabilidad por proyecto'],
    accent: 'amber',
  },
  {
    eyebrow: 'Administración',
    title: 'Facturación y cobranzas',
    description: 'Ordená el circuito administrativo, los servicios recurrentes y la relación financiera con cada cliente.',
    icon: ReceiptText,
    items: ['Facturas internas y comprobantes PDF', 'Pagos y conciliación automática', 'Abonos, renovaciones y recurrencia', 'Portal de autogestión para clientes'],
    accent: 'emerald',
  },
  {
    eyebrow: 'Control',
    title: 'Permisos que siguen tu estructura',
    description: 'Cada persona ve las herramientas y la información que necesita para hacer su trabajo.',
    icon: KeyRound,
    items: ['Matriz de permisos por módulo', 'Visibilidad propia o global', 'Portales separados por tipo de usuario', 'Marca y configuración por organización'],
    accent: 'slate',
  },
]

const roleViews = [
  {
    id: 'direccion',
    tab: 'Dirección',
    title: 'Decisiones con el negocio completo a la vista',
    description: 'Indicadores comerciales, operación, facturación, rentabilidad y carga de trabajo en una sola lectura.',
    icon: Gauge,
    metrics: [
      { label: 'Pipeline activo', value: '34', trend: '+12%' },
      { label: 'Conversión', value: '31%', trend: '+4,2%' },
      { label: 'Tareas al día', value: '92%', trend: '+8%' },
    ],
    feed: ['Objetivo comercial en curso', '3 renovaciones próximas', 'Stock bajo en 4 productos'],
  },
  {
    id: 'ventas',
    tab: 'Ventas',
    title: 'Cada conversación se convierte en una próxima acción',
    description: 'El vendedor trabaja con sus clientes, oportunidades, cotizaciones y seguimientos sin duplicar datos.',
    icon: Target,
    metrics: [
      { label: 'Oportunidades', value: '18', trend: '+6' },
      { label: 'Cotizaciones', value: '11', trend: '+3' },
      { label: 'Seguimientos', value: '7', trend: 'Hoy' },
    ],
    feed: ['Cotización vista por el cliente', 'Nuevo lead desde WhatsApp', 'Seguimiento programado 16:30'],
  },
  {
    id: 'administracion',
    tab: 'Administración',
    title: 'Cobros, compras y documentación sin planillas paralelas',
    description: 'Un perfil operativo-financiero puede gestionar facturación, servicios, proveedores y depósito sin acceder a la configuración crítica.',
    icon: ClipboardCheck,
    metrics: [
      { label: 'Por cobrar', value: '12', trend: '5 vencen' },
      { label: 'Compras', value: '8', trend: 'Este mes' },
      { label: 'Renovaciones', value: '6', trend: '30 días' },
    ],
    feed: ['Pago conciliado automáticamente', 'Factura de proveedor leída con IA', 'Servicio listo para renovar'],
  },
  {
    id: 'tecnicos',
    tab: 'Técnicos',
    title: 'Una vista móvil para saber qué hacer y dónde',
    description: 'Cada técnico recibe su agenda, datos del cliente, tareas y tickets asignados, con acceso ampliable por permisos.',
    icon: Smartphone,
    metrics: [
      { label: 'Visitas', value: '4', trend: 'Hoy' },
      { label: 'Completadas', value: '2', trend: '50%' },
      { label: 'Tickets', value: '3', trend: 'Asignados' },
    ],
    feed: ['09:00 · Instalación en San Martín', '12:30 · Mantenimiento preventivo', '15:00 · Ticket de conectividad'],
  },
  {
    id: 'portales',
    tab: 'Portales',
    title: 'Experiencias separadas para clientes y aliados',
    description: 'Clientes, canal gremio y soporte externo acceden a portales propios, aislados del CRM interno.',
    icon: UserCog,
    metrics: [
      { label: 'Clientes', value: 'Portal', trend: 'Pagos' },
      { label: 'Gremio', value: 'B2B', trend: 'Pedidos' },
      { label: 'Soporte', value: 'Externo', trend: 'Tickets' },
    ],
    feed: ['Descarga de comprobantes', 'Pedido desde catálogo gremio', 'Ticket actualizado por soporte'],
  },
]

const integrations = [
  { name: 'WhatsApp', detail: 'API oficial de Meta', state: 'Disponible', kind: 'live' },
  { name: 'Mercado Pago', detail: 'Cobros y conciliación', state: 'Disponible', kind: 'live' },
  { name: 'Google Calendar', detail: 'Tareas y agenda', state: 'Disponible', kind: 'live' },
  { name: 'SMTP / Amazon SES', detail: 'Emails y campañas', state: 'Disponible', kind: 'live' },
  { name: 'ARCA', detail: 'Emisión fiscal y CAE', state: 'A medida', kind: 'custom' },
  { name: 'Mercado Libre', detail: 'Ventas y catálogo', state: 'A medida', kind: 'custom' },
]

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Pill({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <span className={styles.pill}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  )
}

function HeroProductFlow() {
  return (
    <div className={styles.heroVisual} aria-label="Flujo comercial de JustCRM desde WhatsApp hasta la operación">
      <div className={`${styles.flowTag} ${styles.flowTagOpportunity}`}>
        <Sparkles size={14} /> Nueva oportunidad
      </div>

      <article className={`${styles.productWindow} ${styles.chatWindow}`}>
        <div className={styles.windowTop}>
          <span className={styles.waIcon}><MessageCircle size={16} /></span>
          <strong>WhatsApp · IA</strong>
          <span className={styles.online}><i /> En línea</span>
        </div>
        <div className={styles.chatBody}>
          <div className={styles.inboundBubble}>Necesitamos instalar cámaras en un depósito. ¿Nos pueden ayudar?</div>
          <span className={styles.chatTime}>10:24</span>
          <div className={styles.outboundBubble}>Claro. Te hago unas preguntas para derivarte con el equipo indicado.</div>
          <span className={`${styles.chatTime} ${styles.chatTimeRight}`}>10:24 · ✓✓</span>
          <div className={styles.inboundBubble}>Es en San Martín. Son 8 cámaras y grabación por 30 días.</div>
        </div>
        <div className={styles.messageInput}>
          <span>Escribí un mensaje…</span>
          <button type="button" aria-label="Enviar mensaje"><Send size={15} /></button>
        </div>
      </article>

      <article className={`${styles.productWindow} ${styles.pipelineWindow}`}>
        <div className={styles.pipelineHead}>
          <div>
            <strong>Pipeline de oportunidades</strong>
            <span>18 oportunidades activas · Equipo comercial</span>
          </div>
          <span className={styles.teamBadge}>Vista equipo</span>
        </div>
        <div className={styles.pipelineGrid}>
          <div className={`${styles.pipelineColumn} ${styles.columnCyan}`}>
            <b>01 · Nuevo lead</b>
            <div className={styles.dealCard}>
              <strong>Depósito San Martín</strong>
              <span>8 cámaras · Grabación</span>
              <small>Asignado a Juan</small>
            </div>
          </div>
          <div className={`${styles.pipelineColumn} ${styles.columnViolet}`}>
            <b>02 · Cotización</b>
            <div className={styles.dealCard}>
              <strong>Consorcio Las Torres</strong>
              <span>Control de acceso</span>
              <small>En seguimiento</small>
            </div>
          </div>
          <div className={`${styles.pipelineColumn} ${styles.columnAmber}`}>
            <b>03 · Negociación</b>
            <div className={styles.dealCard}>
              <strong>Fábrica Metalúrgica</strong>
              <span>Alarma y CCTV</span>
              <small>Próxima acción hoy</small>
            </div>
          </div>
        </div>
      </article>

      <div className={`${styles.flowTag} ${styles.flowTagQuote}`}>
        <FileCheck2 size={14} /> Cotización enviada
      </div>
      <article className={`${styles.productWindow} ${styles.quoteWindow}`}>
        <div className={styles.pdfIcon}>PDF</div>
        <div>
          <strong>Propuesta comercial</strong>
          <span>Sistema de videovigilancia</span>
          <small>Lista para seguimiento</small>
        </div>
        <span className={styles.sentBadge}><Check size={12} /> Enviada</span>
      </article>

      <div className={`${styles.flowTag} ${styles.flowTagOperation}`}>
        <CalendarCheck size={14} /> Operación coordinada
      </div>
      <article className={`${styles.productWindow} ${styles.operationWindow}`}>
        <span className={styles.calendarIcon}><CalendarCheck size={17} /></span>
        <div>
          <strong>Instalación programada</strong>
          <span>12 Ago · 08:00 hs</span>
          <small><MapPin size={11} /> San Martín · Equipo asignado</small>
        </div>
        <ChevronRight size={16} />
      </article>

      <i className={`${styles.connector} ${styles.connectorOne}`} />
      <i className={`${styles.connector} ${styles.connectorTwo}`} />
      <i className={`${styles.connector} ${styles.connectorThree}`} />
    </div>
  )
}

function DashboardPreview() {
  return (
    <div className={styles.dashboardFrame} aria-label="Vista del dashboard ejecutivo de JustCRM">
      <aside className={styles.previewSidebar}>
        <img src="/icono-justcrm.png" alt="" />
        {[LayoutDashboard, Users, TrendingUp, FileText, CalendarCheck, ReceiptText].map((Icon, index) => (
          <span key={index} className={index === 0 ? styles.previewNavActive : ''}><Icon size={17} /></span>
        ))}
      </aside>
      <div className={styles.previewContent}>
        <div className={styles.previewHeader}>
          <div><small>Resumen ejecutivo</small><strong>Buenas tardes, equipo</strong></div>
          <span>Octubre 2026</span>
        </div>
        <div className={styles.metricGrid}>
          <div><span>Pipeline</span><strong>34 oportunidades</strong><small>+12% este mes</small></div>
          <div><span>Conversión</span><strong>31%</strong><small>+4,2% vs. anterior</small></div>
          <div><span>Facturación</span><strong>Al día</strong><small>5 pagos conciliados</small></div>
          <div><span>Operación</span><strong>92%</strong><small>Tareas completadas</small></div>
        </div>
        <div className={styles.dashboardLower}>
          <div className={styles.chartCard}>
            <div className={styles.cardTitle}><strong>Evolución comercial</strong><span>Últimos 6 meses</span></div>
            <div className={styles.chartArea}>
              {[34, 45, 39, 61, 58, 78, 66, 88].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
            </div>
            <div className={styles.chartLabels}><span>MAY</span><span>JUN</span><span>JUL</span><span>AGO</span><span>SEP</span><span>OCT</span></div>
          </div>
          <div className={styles.activityCard}>
            <div className={styles.cardTitle}><strong>Actividad</strong><span>En vivo</span></div>
            {[
              ['Nueva oportunidad', 'WhatsApp · hace 2 min'],
              ['Cotización aceptada', 'Ventas · hace 18 min'],
              ['Pago conciliado', 'Administración · hace 31 min'],
              ['Visita completada', 'Operación · hace 46 min'],
            ].map(([title, detail], index) => (
              <div className={styles.activityRow} key={title}>
                <i className={styles[`activity${index}`]} />
                <div><strong>{title}</strong><span>{detail}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CampaignPreview() {
  return (
    <div className={styles.campaignPreview} aria-label="Panel de campañas masivas por email">
      <div className={styles.campaignTop}>
        <div><small>Comunicaciones</small><strong>Campañas masivas</strong></div>
        <button type="button"><Send size={14} /> Nueva campaña</button>
      </div>
      <div className={styles.campaignStats}>
        <div><span>Enviados</span><strong>18.420</strong><small>Este mes</small></div>
        <div><span>Apertura</span><strong>48,6%</strong><small className={styles.positive}>+6,4%</small></div>
        <div><span>Clics</span><strong>12,8%</strong><small className={styles.positive}>+2,1%</small></div>
      </div>
      <div className={styles.campaignTable}>
        <div className={styles.tableHead}><span>Campaña</span><span>Destinatarios</span><span>Rendimiento</span><span>Estado</span></div>
        {[
          ['Renovaciones de octubre', '2.840', '54% aperturas', 'Enviada'],
          ['Novedades para clientes', '5.120', '47% aperturas', 'Enviada'],
          ['Seguimiento comercial', '1.460', 'Lista para revisar', 'Borrador'],
        ].map((row, index) => (
          <div className={styles.tableRow} key={row[0]}>
            <span><i className={styles.campaignDot} />{row[0]}</span>
            <span>{row[1]}</span>
            <span>{row[2]}</span>
            <span className={index === 2 ? styles.statusDraft : styles.statusSent}>{row[3]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MobileOperationPreview() {
  return (
    <div className={styles.phoneFrame} aria-label="Vista móvil Mi Día para técnicos">
      <div className={styles.phoneSpeaker} />
      <div className={styles.phoneScreen}>
        <div className={styles.phoneTop}><span>09:41</span><strong>Mi Día</strong><i /></div>
        <div className={styles.phoneGreeting}><small>Miércoles, 21 de octubre</small><strong>Hola, Martín</strong><span>Tenés 4 visitas programadas</span></div>
        <div className={styles.progressCard}><span>Jornada de hoy</span><strong>2 de 4 completadas</strong><i><b /></i></div>
        <div className={styles.visitCard}>
          <span className={styles.visitTime}>09:00</span>
          <div><small>Instalación</small><strong>Depósito San Martín</strong><span><MapPin size={11} /> Av. Balbín 2840</span></div>
          <CheckCircle2 size={18} />
        </div>
        <div className={`${styles.visitCard} ${styles.visitCurrent}`}>
          <span className={styles.visitTime}>12:30</span>
          <div><small>En curso</small><strong>Mantenimiento preventivo</strong><span><MapPin size={11} /> Villa Ballester</span></div>
          <ChevronRight size={18} />
        </div>
        <div className={styles.phoneAction}><span>Ver datos del cliente</span><ArrowRight size={15} /></div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeRole, setActiveRole] = useState(roleViews[0].id)
  const [contactName, setContactName] = useState('')
  const [contactCompany, setContactCompany] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentRole = roleViews.find((role) => role.id === activeRole) ?? roleViews[0]

  const closeMenu = () => setMobileMenuOpen(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          company: contactCompany,
          email: contactEmail,
          phone: contactPhone,
          message: contactMessage,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos enviar la solicitud.')
      setIsSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No pudimos enviar la solicitud. Probá nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.siteShell}>
      <header className={styles.header}>
        <div className={styles.navbar}>
          <a href="#inicio" className={styles.brand} aria-label="JustCRM, ir al inicio">
            <img src="/Logo-sin-fondo.png" alt="JustCRM" />
          </a>
          <nav className={styles.desktopNav} aria-label="Navegación principal">
            <a href="#producto">Producto</a>
            <a href="#ia">IA</a>
            <a href="#soluciones">Soluciones</a>
            <a href="#usuarios">Usuarios</a>
            <a href="#integraciones">Integraciones</a>
          </nav>
          <div className={styles.navActions}>
            <Link href="/login" className={styles.loginButton}>Ingresar <ArrowRight size={15} /></Link>
            <a href="#contacto" className={styles.primaryButton}>Solicitar demo <ArrowRight size={15} /></a>
            <button
              className={styles.menuButton}
              type="button"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              className={styles.mobileNav}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              aria-label="Navegación móvil"
            >
              {[
                ['Producto', '#producto'], ['IA', '#ia'], ['Soluciones', '#soluciones'],
                ['Usuarios', '#usuarios'], ['Integraciones', '#integraciones'],
              ].map(([label, href]) => <a href={href} onClick={closeMenu} key={href}>{label}<ChevronRight size={16} /></a>)}
              <a href="#contacto" className={styles.mobileCta} onClick={closeMenu}>Solicitar demo <ArrowRight size={16} /></a>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main>
        <section className={styles.hero} id="inicio">
          <div className={styles.heroGlow} />
          <div className={styles.heroGrid}>
            <Reveal className={styles.heroCopy}>
              <Pill icon={Sparkles}>Un CRM que conecta toda tu empresa</Pill>
              <h1>De una conversación a una venta. <span>Todo en movimiento.</span></h1>
              <p>JustCRM conecta WhatsApp con IA, pipeline, cotizaciones y operación en un solo sistema pensado para equipos que necesitan vender, coordinar y crecer.</p>
              <div className={styles.heroActions}>
                <a href="#contacto" className={styles.heroPrimary}>Solicitar demo <ArrowRight size={18} /></a>
                <Link href="/login" className={styles.heroSecondary}>Ingresar <ArrowRight size={18} /></Link>
              </div>
              <div className={styles.heroProof}>
                <span><Zap size={18} />Atención con IA</span>
                <span><BarChart3 size={18} />Más oportunidades</span>
                <span><CheckCircle2 size={18} />Operación centralizada</span>
              </div>
            </Reveal>
            <motion.div
              className={styles.heroVisualWrap}
              initial={{ opacity: 0, scale: 0.96, x: 30 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <HeroProductFlow />
            </motion.div>
          </div>
          <Reveal className={styles.journeyStrip} delay={0.18}>
            {[
              ['01', MessageCircle, 'Captá', 'Las conversaciones entran por WhatsApp y quedan registradas.'],
              ['02', TrendingUp, 'Convertí', 'La IA califica; tu equipo crea oportunidades y cotiza.'],
              ['03', CalendarCheck, 'Operá', 'Coordiná el trabajo, asigná responsables y medí resultados.'],
            ].map(([number, Icon, title, text]) => {
              const StepIcon = Icon as IconType
              return (
                <div className={styles.journeyStep} key={String(number)}>
                  <span className={styles.stepNumber}>{number as string}</span>
                  <span className={styles.stepIcon}><StepIcon size={21} /></span>
                  <div><strong>{title as string}</strong><p>{text as string}</p></div>
                </div>
              )
            })}
          </Reveal>
        </section>

        <section className={styles.section} id="producto">
          <div className={styles.sectionHeadingRow}>
            <Reveal className={styles.sectionHeading}>
              <Pill icon={LayoutDashboard}>Una única fuente de verdad</Pill>
              <h2>El negocio completo, sin saltar entre sistemas.</h2>
            </Reveal>
            <Reveal className={styles.sectionIntro} delay={0.08}>
              <p>JustCRM une el frente comercial con la ejecución real. Cada conversación, cotización, tarea, compra, entrega y cobro conserva su contexto.</p>
            </Reveal>
          </div>
          <Reveal className={styles.dashboardStage} delay={0.12}>
            <DashboardPreview />
            <div className={styles.dashboardCalloutOne}><CheckCircle2 size={16} /><span>Información actualizada para todos</span></div>
            <div className={styles.dashboardCalloutTwo}><ShieldCheck size={16} /><span>Visibilidad según permisos</span></div>
          </Reveal>
        </section>

        <section className={`${styles.section} ${styles.aiSection}`} id="ia">
          <div className={styles.aiGrid}>
            <Reveal className={styles.aiCopy}>
              <Pill icon={Bot}>IA aplicada a tareas concretas</Pill>
              <h2>La IA atiende y ordena. Tu equipo decide.</h2>
              <p>La IA de JustCRM recibe consultas en WhatsApp, entiende el motivo, reúne los datos necesarios y deriva cada caso al área correcta. Cuando hace falta, una persona toma la conversación con todo el contexto.</p>
              <div className={styles.aiChecklist}>
                {[
                  ['Califica consultas', 'Identifica ventas, soporte o administración.'],
                  ['Crea trabajo real', 'Genera una oportunidad o un ticket con el historial.'],
                  ['Deriva con contexto', 'Avisa al responsable y evita volver a preguntar.'],
                  ['Lee documentos', 'Extrae datos de facturas de compra para revisión.'],
                ].map(([title, text]) => (
                  <div key={title}><span><Check size={14} /></span><p><strong>{title}</strong>{text}</p></div>
                ))}
              </div>
              <div className={styles.trustNote}><LockKeyhole size={18} /><span>La IA no inventa precios ni cierra decisiones sensibles: trabaja con reglas y deriva a personas.</span></div>
            </Reveal>
            <Reveal className={styles.aiVisual} delay={0.12}>
              <div className={styles.aiChatCard}>
                <div className={styles.aiChatHeader}><span><Bot size={18} /></span><div><strong>IA de atención</strong><small>WhatsApp conectado</small></div><i /></div>
                <div className={styles.aiMessage}>Hola, necesito soporte con una instalación que hicieron la semana pasada.</div>
                <div className={styles.aiMessageAnswer}>Entiendo. ¿Me compartís la dirección y qué equipo presenta el problema?</div>
                <div className={styles.aiMessage}>Es en Villa Urquiza. Una cámara dejó de transmitir.</div>
                <div className={styles.aiActionCard}><Headphones size={18} /><div><strong>Ticket creado y derivado</strong><span>Soporte · Prioridad alta · Historial adjunto</span></div><CheckCircle2 size={18} /></div>
              </div>
              <div className={styles.aiStatCard}><strong>Menos pasos manuales</strong><span>La conversación alimenta el CRM automáticamente.</span></div>
            </Reveal>
          </div>
        </section>

        <section className={styles.section} id="soluciones">
          <Reveal className={`${styles.sectionHeading} ${styles.centerHeading}`}>
            <Pill icon={Boxes}>Todo el sistema, resumido</Pill>
            <h2>Más que un CRM: una capa operativa para toda la empresa.</h2>
            <p>Las funciones están agrupadas por resultado para que sea fácil entender qué resuelve cada área.</p>
          </Reveal>
          <div className={styles.capabilityGrid}>
            {capabilities.map((capability, index) => {
              const Icon = capability.icon
              return (
                <Reveal className={`${styles.capabilityCard} ${styles[`accent_${capability.accent}`]}`} delay={index * 0.035} key={capability.title}>
                  <div className={styles.capabilityTop}><span><Icon size={21} /></span><small>{capability.eyebrow}</small></div>
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                  <ul>{capability.items.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul>
                </Reveal>
              )
            })}
          </div>
        </section>

        <section className={`${styles.section} ${styles.massSection}`}>
          <div className={styles.massGrid}>
            <Reveal className={styles.massCopy}>
              <Pill icon={Send}>Comunicaciones masivas</Pill>
              <h2>Campañas que salen desde la misma base que tu equipo usa para vender.</h2>
              <p>Creá envíos segmentados, reutilizá plantillas y entendé qué pasó con cada destinatario. El sistema controla límites por organización y respeta automáticamente las bajas.</p>
              <div className={styles.massPoints}>
                <span><MousePointerClick size={17} />Aperturas y clics</span>
                <span><ShieldCheck size={17} />Bajas y supresiones</span>
                <span><Users size={17} />Listas de clientes y empresas</span>
                <span><RefreshCw size={17} />Reintentos de pendientes</span>
              </div>
            </Reveal>
            <Reveal delay={0.1}><CampaignPreview /></Reveal>
          </div>
        </section>

        <section className={styles.section} id="usuarios">
          <Reveal className={`${styles.sectionHeading} ${styles.centerHeading}`}>
            <Pill icon={Users}>Un sistema, distintas experiencias</Pill>
            <h2>Cada usuario entra a una versión relevante de JustCRM.</h2>
            <p>Los roles internos y los portales externos separan responsabilidades sin romper el flujo de información.</p>
          </Reveal>
          <Reveal className={styles.rolesPanel} delay={0.08}>
            <div className={styles.roleTabs} role="tablist" aria-label="Tipos de usuario">
              {roleViews.map((role) => {
                const Icon = role.icon
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeRole === role.id}
                    className={activeRole === role.id ? styles.roleTabActive : ''}
                    onClick={() => setActiveRole(role.id)}
                    key={role.id}
                  >
                    <Icon size={16} />{role.tab}
                  </button>
                )
              })}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentRole.id}
                className={styles.roleContent}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <div className={styles.roleCopy}>
                  <span className={styles.roleIcon}><currentRole.icon size={22} /></span>
                  <h3>{currentRole.title}</h3>
                  <p>{currentRole.description}</p>
                  <a href="#contacto">Verlo aplicado a mi equipo <ArrowRight size={16} /></a>
                </div>
                <div className={styles.roleDashboard}>
                  <div className={styles.roleDashboardHead}><div><small>Vista {currentRole.tab}</small><strong>Resumen de hoy</strong></div><span>Actualizado ahora</span></div>
                  <div className={styles.roleMetrics}>{currentRole.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.trend}</small></div>)}</div>
                  <div className={styles.roleFeed}>{currentRole.feed.map((item, index) => <div key={item}><i className={styles[`feedDot${index}`]} /><span>{item}</span><ChevronRight size={14} /></div>)}</div>
                </div>
              </motion.div>
            </AnimatePresence>
          </Reveal>
        </section>

        <section className={`${styles.section} ${styles.devicesSection}`}>
          <div className={styles.devicesGrid}>
            <Reveal className={styles.devicesCopy}>
              <Pill icon={Smartphone}>Desktop + mobile</Pill>
              <h2>La oficina y el equipo de campo trabajan sobre el mismo dato.</h2>
              <p>En desktop, el equipo administra y analiza. En mobile, cada persona accede a sus próximas acciones, clientes, tareas y tickets sin cargar con toda la complejidad del sistema.</p>
              <ul>
                <li><CheckCircle2 size={17} />Interfaz web adaptable y PWA</li>
                <li><CheckCircle2 size={17} />Agenda personal en “Mi Día”</li>
                <li><CheckCircle2 size={17} />Accesos definidos por rol y módulo</li>
              </ul>
            </Reveal>
            <Reveal className={styles.devicesVisual} delay={0.1}>
              <div className={styles.desktopMini}>
                <div className={styles.desktopBar}><i /><i /><i /><span>crm.justcreate.com.ar</span></div>
                <div className={styles.desktopMiniBody}>
                  <aside><img src="/icono-justcrm.png" alt="" />{[1, 2, 3, 4, 5].map((n) => <i key={n} />)}</aside>
                  <div><strong>Pipeline comercial</strong><span>Vista general del equipo</span><div className={styles.miniKanban}>{[1, 2, 3].map((col) => <section key={col}><b /><i /><i /></section>)}</div></div>
                </div>
              </div>
              <MobileOperationPreview />
            </Reveal>
          </div>
        </section>

        <section className={styles.section} id="integraciones">
          <Reveal className={styles.integrationHeader}>
            <div className={styles.sectionHeading}>
              <Pill icon={CloudCog}>Conectado a tu ecosistema</Pill>
              <h2>Integraciones disponibles y conectores a medida.</h2>
            </div>
            <p>Partimos de lo que JustCRM ya resuelve y definimos los conectores adicionales según el circuito real de tu empresa.</p>
          </Reveal>
          <div className={styles.integrationGrid}>
            {integrations.map((integration, index) => (
              <Reveal className={styles.integrationCard} delay={index * 0.035} key={integration.name}>
                <div className={styles.integrationMark}>{integration.name.slice(0, 2).toUpperCase()}</div>
                <div><strong>{integration.name}</strong><span>{integration.detail}</span></div>
                <small className={integration.kind === 'live' ? styles.liveState : styles.customState}>{integration.state}</small>
              </Reveal>
            ))}
          </div>
          <Reveal className={styles.integrationNote} delay={0.1}>
            <ShieldCheck size={20} />
            <p><strong>Sobre ARCA y Mercado Libre:</strong> se presentan como integraciones opcionales. Se relevan punto de venta, facturación, catálogo y responsabilidades antes de definir alcance, implementación y puesta en producción.</p>
          </Reveal>
        </section>

        <section className={`${styles.section} ${styles.scopeSection}`}>
          <Reveal className={styles.scopeIntro}>
            <Pill icon={Sparkles}>Sin paquetes cerrados</Pill>
            <h2>Una implementación organizada alrededor de tu empresa.</h2>
            <p>No publicamos precios genéricos porque el alcance depende de cuántas personas trabajan, qué módulos necesitan y qué procesos o integraciones hay que adaptar.</p>
          </Reveal>
          <div className={styles.scopeGrid}>
            {[
              { icon: Users, title: 'Tu equipo', text: 'Usuarios, roles, permisos y forma real de colaboración.' },
              { icon: RefreshCw, title: 'Tus procesos', text: 'Circuitos comerciales, operativos y administrativos que deben convivir.' },
              { icon: CloudCog, title: 'Tus integraciones', text: 'Canales, pagos, fiscalización y sistemas existentes que hay que conectar.' },
            ].map((item, index) => {
              const Icon = item.icon
              return <Reveal className={styles.scopeCard} delay={index * 0.06} key={item.title}><span><Icon size={20} /></span><h3>{item.title}</h3><p>{item.text}</p></Reveal>
            })}
          </div>
          <Reveal className={styles.scopeCta} delay={0.14}>
            <div><strong>Primero entendemos cómo trabajan.</strong><span>Después proponemos una versión de JustCRM que tenga sentido para ese negocio.</span></div>
            <a href="#contacto">Conversemos <ArrowRight size={17} /></a>
          </Reveal>
        </section>

        <section className={styles.contactSection} id="contacto">
          <div className={styles.contactGrid}>
            <Reveal className={styles.contactCopy}>
              <Pill icon={MessageCircle}>Hablemos de tu operación</Pill>
              <h2>Veamos dónde JustCRM puede generar más impacto.</h2>
              <p>Contanos cómo vende y opera tu empresa. Nuestro equipo prepara una demostración enfocada en tus procesos, sin obligarte a encajar en un paquete genérico.</p>
              <div className={styles.contactPromises}>
                <span><CheckCircle2 size={17} />Demo guiada con casos de uso reales</span>
                <span><CheckCircle2 size={17} />Relevamiento de usuarios y procesos</span>
                <span><CheckCircle2 size={17} />Propuesta de alcance personalizada</span>
              </div>
              <div className={styles.contactDirect}>
                <small>¿Preferís escribirnos directamente?</small>
                <a href="https://wa.me/5491124527669?text=Hola%20JustCreate%2C%20quiero%20conocer%20JustCRM" target="_blank" rel="noreferrer"><MessageCircle size={17} />WhatsApp de Just Create</a>
              </div>
            </Reveal>
            <Reveal className={styles.contactCard} delay={0.1}>
              {isSubmitted ? (
                <div className={styles.successState}>
                  <span><CheckCircle2 size={32} /></span>
                  <h3>Recibimos tu solicitud.</h3>
                  <p>Gracias, {contactName}. El equipo de Just Create va a contactarte para coordinar una demo enfocada en {contactCompany || 'tu operación'}.</p>
                  <a href="https://wa.me/5491124527669?text=Hola%20JustCreate%2C%20acabo%20de%20solicitar%20una%20demo%20de%20JustCRM" target="_blank" rel="noreferrer">Continuar por WhatsApp <ArrowRight size={16} /></a>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className={styles.formHead}><span>Solicitar una demo</span><strong>Conozcamos tu empresa</strong></div>
                  {submitError && <div className={styles.formError}>{submitError}</div>}
                  <div className={styles.formGrid}>
                    <label>Nombre y apellido<input type="text" required value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Tu nombre" /></label>
                    <label>Empresa<input type="text" value={contactCompany} onChange={(event) => setContactCompany(event.target.value)} placeholder="Nombre de la empresa" /></label>
                    <label>Email corporativo<input type="email" required value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="nombre@empresa.com" /></label>
                    <label>WhatsApp / Teléfono<input type="tel" required value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+54 9 ..." /></label>
                  </div>
                  <label>¿Qué te gustaría ordenar o mejorar?<textarea rows={4} value={contactMessage} onChange={(event) => setContactMessage(event.target.value)} placeholder="Contanos brevemente sobre tu equipo, operación o integración que necesitás." /></label>
                  <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Enviando…' : 'Quiero ver JustCRM'} {!isSubmitting && <ArrowRight size={17} />}</button>
                  <small className={styles.privacyLine}><LockKeyhole size={13} />Usamos tus datos únicamente para responder esta solicitud.</small>
                </form>
              )}
            </Reveal>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <img src="/Logo-sin-fondo.png" alt="JustCRM" />
          <p>Ventas, operación y administración conectadas en un solo sistema.</p>
          <div><a href="#producto">Producto</a><a href="#ia">IA</a><a href="#integraciones">Integraciones</a><a href="#contacto">Contacto</a></div>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} JustCRM · Desarrollado por Just Create</span><Link href="/login">Ingresar al sistema <ArrowRight size={14} /></Link></div>
      </footer>
    </div>
  )
}
