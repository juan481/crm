'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Shield, CheckCircle2, ArrowRight, Zap, Bot, FileText, BarChart3,
  Layers, Users, Package, RefreshCw, Send, Check, Sparkles, Building2,
  Lock, Eye, Cpu, ChevronRight, PhoneCall, ChevronDown, Star, Laptop, Play
} from 'lucide-react'

export default function LandingPage() {
  const [activePersona, setActivePersona] = useState<'seguridad' | 'gerentes' | 'vendedores' | 'administracion' | 'iot'>('seguridad')
  const [activeInteractiveTab, setActiveInteractiveTab] = useState<'cotizador' | 'bot' | 'pipeline'>('cotizador')
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD')
  const [priceMode, setPriceMode] = useState<'GREMIO' | 'PUBLICO'>('GREMIO')
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  // Simulation data for Cotizador
  const demoItems = [
    {
      sku: 'DS-2CD2123G2-I',
      name: 'Domo IP Hikvision AcuSense 2MP Lente 2.8mm',
      desc: 'Detección inteligente de humanos y vehículos. IR 30m, IP67, antivandálica IK10.',
      tipo: 'PRODUCTO',
      cant: 4,
      precioGremio: 85.00,
      precioPublico: 120.00,
    },
    {
      sku: 'DS-7608NI-K2/8P',
      name: 'NVR 8 Canales PoE 4K 80Mbps H.265+',
      desc: 'Grabador digital de red con 8 puertos PoE independientes. Soporta 2 discos rígidos de hasta 8TB.',
      tipo: 'PRODUCTO',
      cant: 1,
      precioGremio: 195.00,
      precioPublico: 270.00,
    },
    {
      sku: 'KIT-INST-SEC-01',
      name: 'Kit de Cableado UTP Exterior + Fuentes + Conectores',
      desc: 'Incluye: 100m Cable UTP Cat5e exterior, 8× Baluns pasivos, 4× Conectores macho/hembra, 1× Fuente switching 12V 5A.',
      tipo: 'KIT',
      cant: 1,
      precioGremio: 70.00,
      precioPublico: 95.00,
    },
    {
      sku: 'SRV-INST-CAM-04',
      name: 'Mano de Obra Instalación, Cableado y Puesta en Marcha',
      desc: 'Fijación de cámaras, canalización estética, ponchado, configuración en NVR y vinculación con app celular Hik-Connect.',
      tipo: 'SERVICIO',
      cant: 1,
      precioGremio: 180.00,
      precioPublico: 240.00,
    }
  ]

  const exchangeRate = 1280
  const subtotalNeto = demoItems.reduce((acc, item) => {
    const unitPrice = priceMode === 'GREMIO' ? item.precioGremio : item.precioPublico
    return acc + (unitPrice * item.cant)
  }, 0)
  const iva = subtotalNeto * 0.21
  const total = subtotalNeto + iva

  const formatPrice = (usd: number) => {
    if (currency === 'USD') {
      return `US$ ${usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return `$ ${(usd * exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const personas = [
    {
      id: 'seguridad',
      label: 'Empresas de Seguridad',
      badge: 'NUESTRO FUERTE',
      title: 'El único CRM pensado desde el día 1 para Seguridad Electrónica & Monitoreo',
      desc: 'Diseñado a medida para instaladores, empresas de alarmas comunitarias, CCTV, cercos eléctricos y monitoreo 24/7. Dejá de sufrir con CRMs genéricos que no entienden de kits, marcas técnicas ni abonos.',
      bullets: [
        'Cotización de Kits de seguridad con componentes desglosados para el depósito pero precio cerrado para el cliente.',
        'Catálogo precargado de marcas líderes: Hikvision, Dahua, DSC, Paradox, Garnet, Intelbras.',
        'Facturación y seguimiento de abonos mensuales recurrentes de monitoreo (MRR).',
        'Órdenes de trabajo, remitos de entrega y partes de servicio técnico para los instaladores.'
      ]
    },
    {
      id: 'gerentes',
      label: 'Gerentes de Ventas',
      badge: 'CONTROL & METRICAS',
      title: 'Visión total del pipeline comercial y supervisión en tiempo real',
      desc: 'Supervisá cada cotización, medí la efectividad de cada vendedor y sabé con certeza cuánto dinero hay en juego en el embudo comercial sin pedir informes en Excel.',
      bullets: [
        'Tablero Kanban interactivo con valor monetario ponderado por cada etapa.',
        'Métricas de conversión, tiempo de respuesta a prospectos y ranking comercial.',
        'Panel de supervisión de WhatsApp: medí cuántas consultas atiende la IA y cuántas toma tu equipo humano.',
        'Historial congelado e inmutable de cada cotización para evitar descuentos no autorizados.'
      ]
    },
    {
      id: 'vendedores',
      label: 'Vendedores',
      badge: 'AGILIDAD & CIERRES',
      title: 'Armá cotizaciones técnicas impecables en 30 segundos y cerrá más ventas',
      desc: 'Eliminá el trabajo tedioso. Buscá productos por modelo o SKU, conmutá entre precios Público y Gremio, calculá en dólares o pesos y enviá el PDF con 1 solo clic.',
      bullets: [
        'Generador de presupuestos con diseño White-Clean de lujo: sin logos recortados feos ni tablas rotas.',
        'Envío automático del PDF por email desde tu propio servidor corporativo.',
        'WhatsApp Web integrado con derivación automática de leads calificados por la IA.',
        'Notificaciones en vivo cuando un cliente aprueba un presupuesto en el portal.'
      ]
    },
    {
      id: 'administracion',
      label: 'Administración & Finanzas',
      badge: 'SIN FRICCIÓN',
      title: 'Facturación ARCA / AFIP, inventario sin facturas y control de cobranzas',
      desc: 'Unificá las ventas con el pañol y la contabilidad. Convertí cualquier cotización ganada en factura legal y orden de entrega sin tipear dos veces.',
      bullets: [
        'Facturación electrónica oficial A, B, C y Notas de Crédito con CAE y código QR.',
        'Conteo físico inicial de stock: cargá mercadería existente sin necesidad de facturas de compra previas.',
        'Portal de clientes: tus clientes descargan facturas y pagan sus abonos con tarjeta o transferencia.',
        'Control estricto de cuentas corrientes, saldos impagos y recibos de cobro.'
      ]
    },
    {
      id: 'iot',
      label: 'Empresas de IoT & Redes',
      badge: 'TECNOLOGÍA & ESCALA',
      title: 'Gestión integral para proyectos de telemetría, sensores y conectividad',
      desc: 'Adaptado para integradores de infraestructura tecnológica, domótica, antenas punto a punto, fibra óptica y sensores inteligentes de IoT.',
      bullets: [
        'Estructuración de propuestas con hardware, licencias en la nube (SaaS) y mantenimiento.',
        'Manejo de números de parte (MPN), números de serie y especificaciones de conectividad.',
        'Soporte técnico estructurado con mesa de ayuda y medición de acuerdos de nivel de servicio (SLA).',
        'API robusta y webhooks para sincronización con plataformas de telemetría externas.'
      ]
    },
  ]

  const activePersonaData = personas.find(p => p.id === activePersona)!

  const faqs = [
    {
      q: '¿Por qué JustCRM es superior para empresas de seguridad frente a HubSpot o Salesforce?',
      a: 'Los CRMs masivos son genéricos y están pensados para software o servicios simples. No entienden la lógica de un kit de cámaras (donde el cliente ve un precio pero el pañol debe entregar 4 cámaras, baluns, fuente y cables), ni tienen distinción nativa entre listas de instalador (Gremio) y usuario final, ni manejan stock físico sin factura previa, ni emiten facturas oficiales con CAE de AFIP/ARCA. Con JustCRM tenés todo resuelto de forma nativa sin pagar licencias de miles de dólares.'
    },
    {
      q: '¿Cómo funciona el Bot de WhatsApp NISSI y cómo interactúa con el catálogo?',
      a: 'NISSI corre sobre el motor Gemini 2.5 Flash de Google, conectado a la API oficial de WhatsApp de Meta. El bot comprende lenguaje natural, conoce todo tu catálogo de cámaras, alarmas y sensores, y responde consultas técnicas de inmediato. Jamás inventa un precio: cuando detecta que el usuario quiere cotizar o tiene una duda puntual, califica al cliente y lo deriva con todo el historial de la conversación directamente al área de Ventas, Soporte o Administración.'
    },
    {
      q: '¿Qué pasa si un vendedor o asesor quiere responder en vivo por WhatsApp?',
      a: 'El CRM cuenta con una bandeja de entrada (Inbox de WhatsApp) compartida. Con un solo clic en "Tomar conversación", el humano toma el control total del chat y NISSI se silencia automáticamente para ese hilo. Cuando el operador termina, puede devolver el control al bot con un botón o el sistema lo reactiva automáticamente a las 24 horas.'
    },
    {
      q: '¿Cómo se resuelven las cotizaciones en dólares y pesos en Argentina?',
      a: 'JustCRM posee un selector multimoneda instantáneo con actualización automática del tipo de cambio oficial del día. Podés cotizar en USD (muy común para hardware importado de CCTV) o en ARS, discriminar o incluir el IVA con alícuotas del 21% o 10.5%, y enviar el PDF con un diseño White-Clean corporativo que deja fascinados a los clientes.'
    },
    {
      q: '¿Qué es el módulo de "Conteo Inicial de Stock"?',
      a: 'Sabemos que muchas empresas de seguridad tienen cientos de equipos comprados con anterioridad o almacenados en pañol de los que no tienen una factura de compra a mano. Nuestro sistema permite realizar un "Conteo Físico Inicial" seleccionando cualquier producto del catálogo y fijando la cantidad real en depósito con un clic, dejando el inventario operativo al instante.'
    },
    {
      q: '¿Cómo se manejan los roles y permisos del personal?',
      a: 'El sistema cuenta con roles preconfigurados (Super Admin, Administrador, Vendedor, Soporte Técnico, Administrativo) y permisos modulares. Podés configurar que tus vendedores solo vean sus propias cotizaciones y prospectos, mientras los gerentes de ventas y directores tienen una panorámica total del negocio.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased overflow-x-hidden">
      
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#090d16]/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                JustCRM <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Security Edition</span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium -mt-0.5">by JustCreate</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#soluciones" className="hover:text-white transition-colors">Para tu Rubro</a>
            <a href="#funciones" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#cotizador-demo" className="hover:text-white transition-colors">Cotizador en Vivo</a>
            <a href="#bot-ia" className="hover:text-white transition-colors">Bot con IA</a>
            <a href="#planes" className="hover:text-white transition-colors">Planes</a>
            <a href="#faq" className="hover:text-white transition-colors">Preguntas</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              Ingresar al CRM
            </Link>
            <a
              href="#contacto"
              className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span>Solicitar Demo</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
        {/* Ambient glow backgrounds */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 -left-48 w-96 h-96 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-indigo-300 mb-8 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>El primer CRM vertical especializado en Empresas de Seguridad & IoT</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1] mb-6">
            Vendé, cotizá y gestioná tu empresa de seguridad <br className="hidden sm:inline" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-300 to-white">
              sin caos y a la velocidad de la luz.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
            Dejá atrás los presupuestos manuales en Word, las notas de WhatsApp desparramadas y el descontrol de depósito.
            JustCRM combina <strong className="text-white font-semibold">Cotizador Inteligente con PDF White-Clean</strong>, <strong className="text-white font-semibold">Bot de WhatsApp con IA para calificar y derivar</strong>, <strong className="text-white font-semibold">Stock sin factura</strong> y <strong className="text-white font-semibold">Facturación ARCA/AFIP</strong> en una sola plataforma.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="#contacto"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-bold text-base shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
            >
              <span>Agendar Demostración Personalizada</span>
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#cotizador-demo"
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-base border border-slate-700/80 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 text-cyan-400" />
              <span>Probar Cotizador Interactivo</span>
            </a>
          </div>

          {/* Social Proof Mini Bar */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-xs font-medium text-slate-400 border-y border-slate-800/80 py-5 max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Integración con WhatsApp Oficial (Meta Cloud)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Cotización oficial Dólar en vivo</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Facturación Electrónica ARCA / AFIP</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Precios Gremio vs Público automáticos</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive App Preview */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 relative z-10">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-2xl shadow-indigo-950/50 p-2 sm:p-4 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 px-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-medium text-slate-400">justcrm.justcreate.com.ar / dashboard / cotizador</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Bot NISSI Activo en WhatsApp
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4 text-left">
              {/* Left Widget: Cotizador Flash */}
              <div className="lg:col-span-7 bg-slate-950/70 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-bold text-white">Cotizador Flash · Presupuesto #PRESUP-2026-X8</h4>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                      Precio Gremio Aplicado
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div>
                        <p className="font-semibold text-slate-200">[DS-2CD2123G2-I] Domo IP Hikvision AcuSense 2MP</p>
                        <p className="text-[11px] text-slate-400">4 unidades × US$ 85,00 (Gremio)</p>
                      </div>
                      <span className="font-bold text-white">US$ 340,00</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div>
                        <p className="font-semibold text-slate-200">[DS-7608NI-K2/8P] NVR 8 Canales PoE 4K</p>
                        <p className="text-[11px] text-slate-400">1 unidad × US$ 195,00 (Gremio)</p>
                      </div>
                      <span className="font-bold text-white">US$ 195,00</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div>
                        <p className="font-semibold text-amber-300 flex items-center gap-1">
                          <Package className="w-3 h-3" /> [KIT-INSTALACION] Kit Conectividad + Cables + Baluns
                        </p>
                        <p className="text-[11px] text-slate-400">Incluye: 100m UTP, 8× baluns, fuentes y conectores</p>
                      </div>
                      <span className="font-bold text-white">US$ 70,00</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Total con IVA (21%):</span>
                    <p className="text-lg font-bold text-emerald-400">US$ 732,05 <span className="text-xs font-normal text-slate-400">($ 937.024 ARS)</span></p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow">
                      <Send className="w-3 h-3" /> Enviar PDF por Email
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Widget: WhatsApp Bot Derivation Stream */}
              <div className="lg:col-span-5 bg-slate-950/70 rounded-xl p-4 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-bold text-white">Bot NISSI (WhatsApp AI)</h4>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">Gemini 2.5 Flash</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-lg rounded-tl-none border border-slate-800 max-w-[90%]">
                      <p className="text-slate-300">"Hola, necesito poner 4 cámaras en una fábrica que detecten personas de noche y no me disparen falsas alarmas con gatos o lluvia."</p>
                      <span className="text-[9px] text-slate-500 block text-right mt-1">Cliente · 16:32</span>
                    </div>

                    <div className="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-lg rounded-tr-none ml-auto max-w-[92%]">
                      <p className="text-emerald-200">
                        "¡Hola! Te recomiendo la línea <strong>Hikvision AcuSense</strong> con análisis perimetral de IA que discrimina vehículos y humanos, con infrarrojo EXIR hasta 30m. Te derivo de inmediato con el área de Ventas Técnicas junto a tu propuesta."
                      </p>
                      <span className="text-[9px] text-emerald-400/60 block text-right mt-1">NISSI (IA) · 16:32</span>
                    </div>

                    <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span><strong>Derivación a Ventas:</strong> Lead creado en Pipeline con transcript completo.</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Asignado a: <strong>Juan (Vendedor)</strong></span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Tomar conversación
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rubros & Personas Tabs (A quién le hablamos) ─────────────── */}
      <section id="soluciones" className="py-20 bg-slate-950/80 border-t border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Especialización Total</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Un CRM diseñado para cada pieza clave de tu empresa
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Seleccioná tu rol o departamento y descubrí cómo JustCRM resuelve tus dolores diarios.
            </p>
          </div>

          {/* Persona selector tabs */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-12">
            {personas.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePersona(p.id as any)}
                className={`px-4 sm:px-6 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${
                  activePersona === p.id
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{p.label}</span>
                {p.id === 'seguridad' && (
                  <span className="text-[10px] bg-cyan-400 text-slate-950 font-bold px-1.5 py-0.2 rounded">
                    ★
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Persona Card Detail */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {activePersonaData.badge}
              </span>
              <span className="text-xs text-slate-400 font-medium">Solución a medida para tu operación</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              {activePersonaData.title}
            </h3>

            <p className="text-slate-300 text-base leading-relaxed mb-8">
              {activePersonaData.desc}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePersonaData.bullets.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-slate-200 font-medium leading-snug">{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive Demo Showcase: Cotizador en Vivo ─────────────── */}
      <section id="cotizador-demo" className="py-24 relative overflow-hidden bg-[#090d16]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Pruébelo Usted Mismo</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              El Cotizador Técnico más veloz y potente del mercado
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Probá cómo se recalcula un presupuesto técnico en vivo alternando entre lista Gremio o Público, y cambiando entre Dólares o Pesos.
            </p>
          </div>

          <div className="max-w-5xl mx-auto bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8">
            
            {/* Control Bar: Currency & Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-400">Lista de Precios:</span>
                <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
                  <button
                    onClick={() => setPriceMode('GREMIO')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      priceMode === 'GREMIO'
                        ? 'bg-emerald-500 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Gremio / Instalador
                  </button>
                  <button
                    onClick={() => setPriceMode('PUBLICO')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      priceMode === 'PUBLICO'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Público Final
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-400">Moneda:</span>
                <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
                  <button
                    onClick={() => setCurrency('USD')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      currency === 'USD'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    USD (Dólares)
                  </button>
                  <button
                    onClick={() => setCurrency('ARS')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      currency === 'ARS'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ARS ($ 1.280)
                  </button>
                </div>
              </div>
            </div>

            {/* Simulated Clean PDF Table */}
            <div className="rounded-2xl border border-slate-800 bg-white text-slate-900 p-6 shadow-inner font-sans">
              
              {/* White-Clean PDF Header Design */}
              <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                    AB
                  </div>
                  <div>
                    <h4 className="text-lg font-extrabold text-slate-900 leading-tight">ABBA SEGURIDAD ELECTRÓNICA</h4>
                    <p className="text-[11px] text-slate-500 font-medium">CCTV · Alarmas · Redes · Control de Accesos</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-full bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider">
                    PRESUPUESTO
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">Ref: PRESUP-2026-AB · {new Date().toLocaleDateString('es-AR')}</p>
                </div>
              </div>

              {/* Table items */}
              <div className="space-y-3">
                <div className="grid grid-cols-12 text-[11px] font-bold text-slate-500 uppercase pb-2 border-b border-slate-200">
                  <div className="col-span-6">Ítem & Especificación Técnica</div>
                  <div className="col-span-2 text-center">Tipo</div>
                  <div className="col-span-2 text-center">Cantidad</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {demoItems.map((item, idx) => {
                  const unitPrice = priceMode === 'GREMIO' ? item.precioGremio : item.precioPublico
                  const lineTotal = unitPrice * item.cant
                  return (
                    <div key={idx} className="grid grid-cols-12 text-xs py-2 border-b border-slate-100 items-center">
                      <div className="col-span-6 pr-2">
                        <p className="font-bold text-slate-900 leading-snug">
                          <span className="text-indigo-600 font-mono text-[11px]">[{item.sku}]</span> {item.name}
                        </p>
                        <p className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">{item.desc}</p>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.tipo === 'KIT'
                            ? 'bg-amber-100 text-amber-800'
                            : item.tipo === 'SERVICIO'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {item.tipo}
                        </span>
                      </div>
                      <div className="col-span-2 text-center text-slate-600 font-medium">
                        {item.cant} × unidad
                      </div>
                      <div className="col-span-2 text-right font-bold text-slate-900">
                        {formatPrice(lineTotal)}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Totals Box */}
              <div className="mt-5 flex justify-end">
                <div className="w-64 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Neto:</span>
                    <span className="font-semibold">{formatPrice(subtotalNeto)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>IVA (21%):</span>
                    <span>{formatPrice(iva)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-indigo-700">
                    <span>TOTAL (IVA incl.):</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <p>✓ Cotización válida por 15 días luego de su emisión.</p>
                <p className="font-semibold text-indigo-600">Generado con JustCRM White-Clean Engine</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                ⚡ Podés descargarlo como PDF o enviarlo automáticamente por correo al cliente desde el CRM.
              </div>
              <a
                href="#contacto"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow"
              >
                <span>Quiero esta función para mi empresa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Grid: Todo lo que incluye el CRM ──────────────────── */}
      <section id="funciones" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Capacidades Completas</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Todas las herramientas para dominar tu operación comercial
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              No dejes nada al azar. Cada módulo fue construido para que tu equipo ahorre horas de trabajo diario.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-indigo-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Cotizador Técnico & PDF White-Clean</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Generá presupuestos con código SKU, descripciones multilínea, KITS desglosados y alícuotas de IVA exactas. Envío por email directo en 1 clic.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Bot de WhatsApp con IA (NISSI)</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Asesor técnico con Gemini 2.5 Flash que atiende consultas por WhatsApp 24/7, conoce tu catálogo y deriva a Ventas o Soporte con transcript completo.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-cyan-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Pipeline Visual Drag & Drop</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Embudo de oportunidades conectado a las cotizaciones y WhatsApp. Arrastrá tratos, medí probabilidades y no pierdas jamás un prospecto.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-amber-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-600/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Conteo Inicial de Stock sin Factura</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Cargá todo el inventario físico que ya tenés en depósito sin trabarte por no tener las facturas de compra anteriores. Órdenes de entrega automáticas.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-purple-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Facturación Fiscal ARCA / AFIP</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Emisión de comprobantes electrónicos legales (A, B, C) con CAE y QR. Cobro de abonos mensuales recurrentes y seguimiento de cuentas corrientes.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-blue-500/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Matriz de Roles & Permisos Modulares</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Super Admin, Gerente, Vendedor, Técnico y Administrativo. Cada usuario ve exactamente lo que le corresponde, protegiendo tus datos y márgenes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing / Suscripción Tiers ──────────────────────────────── */}
      <section id="planes" className="py-24 bg-[#090d16] border-t border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Planes Transparentes</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Invertí en el crecimiento real de tu empresa de seguridad
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Comenzá hoy mismo y activá tu CRM con soporte e implementación guiada por JustCreate.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            
            {/* Plan 1 */}
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <h3 className="text-xl font-bold text-white">Starter Instalador</h3>
                <p className="text-xs text-slate-400 mt-1">Para técnicos independientes y equipos chicos de hasta 3 personas.</p>
                <div className="mt-6 mb-6">
                  <span className="text-4xl font-extrabold text-white">Consultar</span>
                  <span className="text-xs text-slate-400 block mt-1">Planes a medida en pesos o dólares</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Hasta 3 usuarios incluidos</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Cotizador Flash ilimitado con PDF White-Clean</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Catálogo de productos & precios Gremio</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Pipeline de ventas Kanban</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Control básico de stock físico</li>
                </ul>
              </div>
              <a
                href="#contacto"
                className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs text-center transition-all"
              >
                Solicitar Cotización Starter
              </a>
            </div>

            {/* Plan 2: Destacado */}
            <div className="rounded-3xl bg-gradient-to-b from-indigo-900/40 via-slate-900 to-slate-900 border-2 border-indigo-500 p-8 flex flex-col justify-between shadow-2xl shadow-indigo-950/60 relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow">
                MÁS ELEGIDO POR EMPRESAS
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Security Pro & Bot IA</h3>
                <p className="text-xs text-slate-300 mt-1">Para empresas de seguridad, CCTV y monitoreo en expansión.</p>
                <div className="mt-6 mb-6">
                  <span className="text-4xl font-extrabold text-white">Plan Pro</span>
                  <span className="text-xs text-indigo-300 block mt-1">Con Bot de WhatsApp NISSI Gemini 2.5</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-200">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> <strong>Usuarios ilimitados</strong> para todo el equipo</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> <strong>Bot NISSI WhatsApp con IA (Meta Oficial)</strong></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Derivación automática con transcript a Ventas/Soporte</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Inbox compartido de WhatsApp con Takeover humano</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Facturación electrónica oficial ARCA / AFIP</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Portal de autogestión de clientes</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Conteo inicial de stock sin factura</li>
                </ul>
              </div>
              <a
                href="#contacto"
                className="mt-8 w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-slate-950 font-extrabold text-xs text-center shadow-lg shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5"
              >
                Comenzar con Plan Pro
              </a>
            </div>

            {/* Plan 3 */}
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <h3 className="text-xl font-bold text-white">Enterprise White-Label</h3>
                <p className="text-xs text-slate-400 mt-1">Para grandes integradores, franquicias o múltiples sucursales.</p>
                <div className="mt-6 mb-6">
                  <span className="text-4xl font-extrabold text-white">A Medida</span>
                  <span className="text-xs text-slate-400 block mt-1">Servidor dedicado + Marca blanca total</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Servidor privado dedicado en Hetzner / AWS</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Dominio propio (crm.tuempresa.com)</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Múltiples organizaciones / sucursales aisladas</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Integraciones personalizadas por API</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Soporte prioritario directo con ingenieros</li>
                </ul>
              </div>
              <a
                href="#contacto"
                className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs text-center transition-all"
              >
                Contactar a Ventas Enterprise
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ── FAQ Section ──────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Preguntas Frecuentes</span>
            <h2 className="text-3xl font-extrabold text-white mt-2">
              Todo lo que necesitás saber antes de empezar
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white hover:text-indigo-300 transition-colors"
                >
                  <span className="text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 flex-shrink-0 text-slate-400 transition-transform ${faqOpen === idx ? 'rotate-180 text-indigo-400' : ''}`} />
                </button>
                {faqOpen === idx && (
                  <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final Call to Action / Contact Form ──────────────────────── */}
      <section id="contacto" className="py-24 bg-gradient-to-b from-[#090d16] to-slate-950 border-t border-slate-800 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Llevá tu empresa de seguridad al siguiente nivel
          </h2>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-10">
            Completá tus datos y un especialista técnico de JustCreate te contactará hoy mismo para coordinar una demo guiada de 15 minutos en vivo.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              alert('¡Gracias por tu interés! Un especialista se pondrá en contacto a la brevedad.')
            }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl max-w-xl mx-auto text-left space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tu Nombre y Apellido</label>
              <input
                type="text"
                required
                placeholder="Ej. Juan Pérez"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nombre de tu Empresa</label>
              <input
                type="text"
                required
                placeholder="Ej. Alarmas & Seguridad Integral SRL"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email de Contacto</label>
                <input
                  type="email"
                  required
                  placeholder="juan@seguridad.com"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">WhatsApp / Teléfono</label>
                <input
                  type="tel"
                  required
                  placeholder="+54 9 11 ..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Rubro Principal</label>
              <select className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors">
                <option>Empresa de Seguridad Electrónica & CCTV</option>
                <option>Monitoreo de Alarmas 24/7</option>
                <option>Integrador Tecnológico / IoT</option>
                <option>Cercos Eléctricos & Control de Accesos</option>
                <option>Telecomunicaciones & Redes</option>
                <option>Otro rubro afín</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-4 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5"
            >
              Solicitar Demostración y Asesoramiento
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-2">
              Sin contratos forzados · Implementación guiada paso a paso por JustCreate
            </p>
          </form>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="py-12 bg-slate-950 border-t border-slate-900 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              J
            </div>
            <span>JustCRM · Desarrollado con orgullo por <a href="https://justcreate.com.ar" target="_blank" rel="noreferrer" className="text-slate-300 hover:text-white underline">JustCreate</a></span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-300 transition-colors">Iniciar Sesión</Link>
            <a href="#soluciones" className="hover:text-slate-300 transition-colors">Soluciones</a>
            <a href="#planes" className="hover:text-slate-300 transition-colors">Planes</a>
            <a href="mailto:contacto@justcreate.com.ar" className="hover:text-slate-300 transition-colors">contacto@justcreate.com.ar</a>
          </div>

          <p>© {new Date().getFullYear()} JustCRM. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
