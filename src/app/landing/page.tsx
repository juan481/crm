'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Shield, Zap, Bot, FileText, BarChart3, Layers, Package, Users,
  CheckCircle2, ArrowRight, Play, Clock, Sparkles, Send, Check,
  ChevronDown, PhoneCall, AlertTriangle, Eye, RefreshCw, X,
  TrendingUp, DollarSign, Calendar, MessageSquare, Flame, CheckCheck,
  Receipt, ArrowUpRight, Laptop, Smartphone, Lock, Folder, Download,
  Search, Filter, Plus, UserCheck, HelpCircle, HardDriveDownload
} from 'lucide-react'

export default function LandingPage() {
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD')
  const [priceMode, setPriceMode] = useState<'GREMIO' | 'PUBLICO'>('GREMIO')
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  const faqs = [
    {
      q: '¿Por qué JustCRM es superior para empresas de seguridad y servicios técnicos frente a un CRM tradicional?',
      a: 'Los CRMs tradicionales (HubSpot, Zoho, Salesforce) son genéricos y están pensados para software o empresas de servicios simples. No entienden la lógica de kits con componentes desglosados para el pañol, no manejan listas duales de Gremio vs Público, no permiten cargar stock físico sin factura de compra y no emiten facturas electrónicas con CAE de AFIP. Con JustCRM tenés todo resuelto de forma nativa sin pagar licencias de miles de dólares.'
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
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased overflow-x-hidden">
      
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#070b14]/90 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-500 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                JustCRM <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Productivity OS</span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium -mt-0.5">by JustCreate</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <a href="#dashboard" className="hover:text-white transition-colors">Dashboard</a>
            <a href="#clientes" className="hover:text-white transition-colors">Clientes 360°</a>
            <a href="#catalogo" className="hover:text-white transition-colors">Catálogo</a>
            <a href="#cotizador" className="hover:text-white transition-colors">Cotizador Flash</a>
            <a href="#pipeline" className="hover:text-white transition-colors">Pipeline</a>
            <a href="#tickets" className="hover:text-white transition-colors">Soporte & SLA</a>
            <a href="#stock" className="hover:text-white transition-colors">Depósito</a>
            <a href="#whatsapp" className="hover:text-white transition-colors">WhatsApp IA</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-bold px-3.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              Ingresar
            </Link>
            <a
              href="#contacto"
              className="text-xs font-black px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-indigo-600 to-cyan-500 hover:from-red-600 hover:to-indigo-600 text-white shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-1.5"
            >
              <span>Solicitar Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero: Menos Caos, Más Productividad, Respuesta Instantánea ── */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden text-center">
        {/* Glow ambient effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-gradient-to-tr from-red-600/15 via-indigo-600/20 to-cyan-400/15 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700/80 text-xs font-bold text-indigo-300 mb-8 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Optimizá la gestión interna y pulverizá los tiempos de respuesta</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.05] mb-6">
            Achicá el caos operativo. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-indigo-300 to-cyan-300">
              Dispará la productividad de tu equipo.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
            El CRM todo-en-uno que conecta tus <strong className="text-white font-semibold">ventas</strong>, tus <strong className="text-white font-semibold">técnicos</strong> y tu <strong className="text-white font-semibold">administración</strong>. Cotizaciones en 30 segundos, WhatsApp con IA 24/7, catálogo mayorista con precios Gremio y control milimétrico de tareas y depósito.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="#contacto"
              className="w-full sm:w-auto px-9 py-4 rounded-xl bg-gradient-to-r from-red-500 via-indigo-600 to-cyan-500 hover:from-red-600 hover:to-indigo-600 text-white font-black text-base shadow-xl shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
            >
              <span>Agendar Demostración Personalizada</span>
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#dashboard"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-base border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>Ver Todas las Pantallas y Módulos</span>
            </a>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tiempo de Respuesta</span>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">2 Segundos</p>
              <p className="text-[11px] text-slate-400">Atención con IA 24/7</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cotización Flash</span>
              <p className="text-xl sm:text-2xl font-black text-cyan-400 mt-0.5">30 Segundos</p>
              <p className="text-[11px] text-slate-400">PDF White-Clean en vivo</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Depósito & Pañol</span>
              <p className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">Conteo Inicial</p>
              <p className="text-[11px] text-slate-400">Stock activo sin facturas</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Facturación Legal</span>
              <p className="text-xl sm:text-2xl font-black text-indigo-400 mt-0.5">ARCA / AFIP</p>
              <p className="text-[11px] text-slate-400">Comprobantes A, B, C con CAE</p>
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* LA SÁBANA COMPLETA DE PANTALLAS Y FUNCIONES DEL SISTEMA        */}
      {/* ════════════════════════════════════════════════════════════════ */}

      {/* ── MÓDULO 1: DASHBOARD EJECUTIVO ────────────────────────────── */}
      <section id="dashboard" className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-10 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5 mb-2">
              <BarChart3 className="w-4 h-4 text-red-400" />
              Módulo 01 · Control Total del Negocio
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Dashboard: Resumen de tu negocio en tiempo real
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              <strong>El dolor que elimina:</strong> Se terminó pedir informes a ciegas en Excel o no saber cuánto dinero ingresó por abonos recurrentes. Tené el pulso financiero y operativo de tu empresa en una sola pantalla.
            </p>
          </div>

          {/* UI Mockup: Dashboard */}
          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-black text-white">Dashboard</h3>
                <p className="text-xs text-slate-400">Resumen de tu negocio en tiempo real</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> En jornada · 01:06 p. m.
                </span>
              </div>
            </div>

            {/* Stat Cards 4 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-5 rounded-2xl bg-white text-slate-900 shadow-sm">
                <span className="text-3xl font-black block">34</span>
                <span className="text-xs text-slate-500 font-bold mt-1 block">Clientes Activos</span>
              </div>
              <div className="p-5 rounded-2xl bg-white text-slate-900 shadow-sm relative">
                <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1">
                  ↗ 100%
                </span>
                <span className="text-2xl font-black text-emerald-600 block">$ 1.934.400</span>
                <span className="text-xs text-slate-500 font-bold mt-1 block">Ingresos del Mes (crecimiento mensual)</span>
              </div>
              <div className="p-5 rounded-2xl bg-white text-slate-900 shadow-sm">
                <span className="text-3xl font-black text-amber-500 block">0</span>
                <span className="text-xs text-slate-500 font-bold mt-1 block">Pagos Pendientes (facturas con pago pendiente)</span>
              </div>
              <div className="p-5 rounded-2xl bg-white text-slate-900 shadow-sm">
                <span className="text-3xl font-black text-red-500 block">0</span>
                <span className="text-xs text-slate-500 font-bold mt-1 block">Facturas Vencidas (requieren atención)</span>
              </div>
            </div>

            {/* Middle Grid: MRR Chart & Donut */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
              <div className="lg:col-span-8 p-6 rounded-2xl bg-white text-slate-900 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Ingresos Recurrentes (MRR)</h4>
                    <p className="text-xs text-slate-400">Abonos de monitoreo y servicios mensuales</p>
                  </div>
                  <span className="text-xs text-slate-400">Últimos 6 meses</span>
                </div>
                {/* SVG Mock Curve */}
                <div className="h-44 w-full flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
                    <path
                      d="M 0,140 Q 200,135 350,110 T 500,20"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="4"
                    />
                    <path
                      d="M 0,140 Q 200,135 350,110 T 500,20 L 500,150 L 0,150 Z"
                      fill="rgba(239, 68, 68, 0.08)"
                    />
                    <circle cx="500" cy="20" r="5" fill="#ef4444" />
                  </svg>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-2 font-mono">
                  <span>abr 26</span>
                  <span>may 26</span>
                  <span>jun 26</span>
                  <span>jul 26</span>
                  <span>ago 26</span>
                  <span className="font-bold text-red-500">sept 26 ($ 2.000k MRR)</span>
                </div>
              </div>

              <div className="lg:col-span-4 p-6 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1">Facturas por Estado</h4>
                  <p className="text-xs text-slate-400 mb-4">Eficiencia en cobros</p>
                  <div className="w-32 h-32 mx-auto rounded-full border-8 border-emerald-500 flex items-center justify-center my-4">
                    <span className="text-xs font-black text-emerald-600">100% Pagada</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600">
                  <span className="w-3 h-3 rounded bg-emerald-500" />
                  <span>Pagadas al día</span>
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Nuevos Clientes este mes</span>
                <p className="text-xl font-bold text-white mt-0.5">20</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Ingresos Anuales Estimados</span>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">$ 23.212.800</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Ingreso promedio por cliente</span>
                <p className="text-xl font-bold text-cyan-400 mt-0.5">$ 56.894</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MÓDULO 2: CLIENTES 360° & HISTORIAL CENTRALIZADO ─────────── */}
      <section id="clientes" className="py-20 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-10 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Módulo 02 · Ficha 360° del Cliente
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Cero Información Perdida: Todo lo que pasó con el cliente en un solo lugar
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              <strong>El dolor que elimina:</strong> Si el vendedor renuncia o falta, la empresa ya no queda ciega. En la ficha del cliente quedan guardadas sus cotizaciones, tickets, tratos y hasta las notas con transcripción de los chats de WhatsApp.
            </p>
          </div>

          {/* UI Mockup: Ficha del Cliente */}
          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left">
            <div className="p-6 rounded-2xl bg-white text-slate-900 mb-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center font-black text-xl shadow">
                    EC
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900">Empresa de Servicios Corporativos</h3>
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">Cliente Activo</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">contacto@empresa-cliente.com · Eduardo Castex, La Pampa</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> + Cotizar
                  </button>
                  <button className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs">
                    Editar datos
                  </button>
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 text-center">
                <div>
                  <span className="text-xl font-black text-slate-900">2</span>
                  <span className="text-[11px] text-slate-400 block font-bold">Deals activos</span>
                </div>
                <div>
                  <span className="text-xl font-black text-emerald-600">US$ 1.840</span>
                  <span className="text-[11px] text-slate-400 block font-bold">Valor esperado</span>
                </div>
                <div>
                  <span className="text-xl font-black text-slate-900">0</span>
                  <span className="text-[11px] text-slate-400 block font-bold">Tickets abiertos</span>
                </div>
                <div>
                  <span className="text-xl font-black text-slate-900">1</span>
                  <span className="text-[11px] text-slate-400 block font-bold">Tareas pending</span>
                </div>
              </div>
            </div>

            {/* Timeline tabs & Activity */}
            <div className="p-6 rounded-2xl bg-white text-slate-900 shadow-sm">
              <div className="flex gap-6 border-b border-slate-200 pb-3 mb-4 text-xs font-bold text-slate-500">
                <span className="text-red-500 border-b-2 border-red-500 pb-3 -mb-3 cursor-pointer">Actividad</span>
                <span className="hover:text-slate-900 cursor-pointer">Deals (2)</span>
                <span className="hover:text-slate-900 cursor-pointer">Cotizaciones (3)</span>
                <span className="hover:text-slate-900 cursor-pointer">Tickets (0)</span>
                <span className="hover:text-slate-900 cursor-pointer">Tareas (1)</span>
                <span className="hover:text-slate-900 cursor-pointer">Contactos (2)</span>
              </div>

              {/* Timeline message */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Nota de Asesor Comercial · Sebastián P.
                    </span>
                    <span className="text-[10px] text-slate-400">hace 2 horas</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed font-mono text-[11px] bg-white p-3 rounded border border-slate-200 mt-2">
                    [13:10] Sebastián P: "Daniel, ¿cómo estás? Te paso el presupuesto de los 4 domos IP AcuSense con el NVR de 8 canales que charlamos por WhatsApp. Quedó aplicado el precio Gremio." <br />
                    [13:12] Cliente: "Recibido Sebastián, excelente presentación en PDF. Mañana lo aprobamos en la reunión de consorcio."
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 3: CATÁLOGO COMERCIAL & PRECIOS GREMIO ───────────── */}
      <section id="catalogo" className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-10 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
              <Package className="w-4 h-4 text-amber-400" />
              Módulo 03 · Catálogo Centralizado
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Más de 2.300 productos con precios Público y Gremio
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              <strong>El dolor que elimina:</strong> Vendedores pasando precios viejos, buscando en PDF gigantescos de distribuidores o vendiendo por debajo del margen. Todo tu catálogo de cámaras, alarmas, cables y detectores con stock en vivo.
            </p>
          </div>

          {/* UI Mockup: Catálogo */}
          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-xs shadow">
                  Productos (2.314)
                </span>
                <span className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer">
                  Servicios Propios
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    disabled
                    value="Hikvision, Dahua, Garrett, TP-Link..."
                    className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-4 py-2 text-xs text-slate-300 w-64"
                  />
                </div>
              </div>
            </div>

            {/* Product Grid Showcase */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="h-20 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">
                    FIBRA
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">FIBRA ÓPTICA</span>
                  <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">(0135501080) TP-LINK Transceiver SFP 1.25G</p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 font-black text-emerald-700">
                  Gremio US$ 22,84
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="h-20 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">
                    KIT MON
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">KITS MONITOREO</span>
                  <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">(SOLO VENTA EN KIT) Transmisor 4G FRS</p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 font-black text-emerald-700">
                  Gremio US$ 140,00
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="h-20 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">
                    GARRETT
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">DETECTOR METAL</span>
                  <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">1165800 DETECTOR MANUAL GARRETT SUPER SCANNER</p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 font-black text-emerald-700">
                  Gremio US$ 434,30
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="h-20 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">
                    DAHUA
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">XVR 16 CANALES</span>
                  <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">16 CH PENTA-BRID 5M-N DAHUA DH-XVR5116</p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 font-black text-emerald-700">
                  Gremio US$ 215,00
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="h-20 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">
                    SOYAL
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700">CONTROL ACCESO</span>
                  <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">16 PUERTAS CON SALIDA TCP/IP SOYAL AR-716E</p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 font-black text-emerald-700">
                  Gremio US$ 320,00
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="h-20 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">
                    HIKVISION
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">VIDEO PORTERO</span>
                  <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">ACCESORIO DE MONTAJE EMPOTRABLE HIKVISION</p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 font-black text-emerald-700">
                  Gremio US$ 72,96
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MÓDULO 4: COTIZADOR FLASH & PDF WHITE-CLEAN ─────────────── */}
      <section id="cotizador" className="py-20 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-10 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Módulo 04 · Cotizador en 30 Segundos
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Cotizaciones técnicas con PDF corporativo White-Clean
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              <strong>El dolor que elimina:</strong> Presupuestos que tardaban 45 minutos en armarse en Word con tablas desalineadas y logos pixelados. Ahora tu vendedor cotiza mientras habla por teléfono y el cliente lo recibe en su correo con 1 clic.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-400">Lista Aplicada:</span>
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

            {/* The White-Clean PDF Rendered */}
            <div className="rounded-2xl bg-white text-slate-900 p-6 shadow-inner border border-slate-200">
              <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                    AB
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 leading-tight">ABBA SEGURIDAD ELECTRÓNICA</h4>
                    <p className="text-[11px] text-slate-500 font-medium">CCTV · Alarmas · Redes · Control de Accesos</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-full bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider">
                    PRESUPUESTO OFICIAL
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">Ref: PRESUP-2026-AB · {new Date().toLocaleDateString('es-AR')}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-12 text-[11px] font-bold text-slate-500 uppercase pb-2 border-b border-slate-200">
                  <div className="col-span-6">Ítem & Código SKU</div>
                  <div className="col-span-2 text-center">Tipo</div>
                  <div className="col-span-2 text-center">Cantidad</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                <div className="grid grid-cols-12 text-xs py-2 border-b border-slate-100 items-center">
                  <div className="col-span-6 pr-2">
                    <p className="font-bold text-slate-900"><span className="text-indigo-600 font-mono">[DS-2CD2123G2-I]</span> Domo IP Hikvision AcuSense 2MP 2.8mm</p>
                    <p className="text-[11px] text-slate-500 italic">Detección inteligente de humanos y vehículos. IR 30m, IK10 antivandálica.</p>
                  </div>
                  <div className="col-span-2 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">PRODUCTO</span></div>
                  <div className="col-span-2 text-center text-slate-600 font-medium">4 × unidad</div>
                  <div className="col-span-2 text-right font-bold text-slate-900">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 340,00' : '$ 435.200') : (currency === 'USD' ? 'US$ 480,00' : '$ 614.400')}</div>
                </div>

                <div className="grid grid-cols-12 text-xs py-2 border-b border-slate-100 items-center">
                  <div className="col-span-6 pr-2">
                    <p className="font-bold text-slate-900"><span className="text-indigo-600 font-mono">[DS-7608NI-K2/8P]</span> NVR Grabador 8 Canales PoE 4K</p>
                    <p className="text-[11px] text-slate-500 italic">8 puertos PoE integrados independientes. Soporta 2 discos de 8TB.</p>
                  </div>
                  <div className="col-span-2 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">PRODUCTO</span></div>
                  <div className="col-span-2 text-center text-slate-600 font-medium">1 × unidad</div>
                  <div className="col-span-2 text-right font-bold text-slate-900">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 195,00' : '$ 249.600') : (currency === 'USD' ? 'US$ 270,00' : '$ 345.600')}</div>
                </div>

                <div className="grid grid-cols-12 text-xs py-2 border-b border-slate-100 items-center">
                  <div className="col-span-6 pr-2">
                    <p className="font-bold text-slate-900"><span className="text-amber-600 font-mono">[KIT-CONEXION-04]</span> Kit Cableado UTP + Baluns + Fuentes</p>
                    <p className="text-[11px] text-slate-500 italic">Incluye: 100m UTP Cat5e exterior, 8× baluns pasivos, 4 fuentes estancas 12V 2A y conectores.</p>
                  </div>
                  <div className="col-span-2 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">KIT</span></div>
                  <div className="col-span-2 text-center text-slate-600 font-medium">1 × kit</div>
                  <div className="col-span-2 text-right font-bold text-slate-900">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 70,00' : '$ 89.600') : (currency === 'USD' ? 'US$ 95,00' : '$ 121.600')}</div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <div className="w-64 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Neto:</span>
                    <span className="font-bold">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 605,00' : '$ 774.400') : (currency === 'USD' ? 'US$ 845,00' : '$ 1.081.600')}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>IVA (21%):</span>
                    <span>{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 127,05' : '$ 162.624') : (currency === 'USD' ? 'US$ 177,45' : '$ 227.136')}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-indigo-700">
                    <span>TOTAL (IVA incl.):</span>
                    <span>{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 732,05' : '$ 937.024') : (currency === 'USD' ? 'US$ 1.022,45' : '$ 1.308.736')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span>⚡ Enviar directo por correo electrónico al cliente desde el CRM.</span>
              <button className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow">
                <Send className="w-3.5 h-3.5" /> Enviar PDF por Email con 1 Clic
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── MÓDULO 5: PIPELINE COMERCIAL KANBAN ──────────────────────── */}
      <section id="pipeline" className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-10 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Módulo 05 · Pipeline de Ventas
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Embudo Comercial Drag & Drop: Seguimiento sin pérdidas
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              <strong>El dolor que elimina:</strong> Prospectos que se enfrían en libretas o notas sueltas. Visualizá en qué etapa está cada venta, cuánto dinero hay en juego y qué vendedor tiene la responsabilidad.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Pipeline de Oportunidades</h3>
                <p className="text-xs text-slate-400">Total activo: <strong className="text-emerald-400">US$ 28.450</strong> · 18 tratos en curso</p>
              </div>
              <span className="text-xs px-3 py-1 rounded bg-slate-800 text-slate-300 font-bold">Todo el Equipo Comercial</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                <span className="font-bold text-slate-400 block mb-2">1. Nuevo Lead (IA)</span>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">WhatsApp NISSI</span>
                  <p className="font-bold text-white mt-1">Galpón Logística 8 Cámaras</p>
                  <p className="text-[11px] text-slate-400">Distribuidora San Martín</p>
                  <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold">
                    <span className="text-slate-400">Est: US$ 1.840</span>
                    <span className="text-indigo-400">Asig: Juan</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                <span className="font-bold text-indigo-400 block mb-2">2. Cotización Enviada</span>
                <div className="p-3 rounded-xl bg-slate-900 border border-indigo-500/30">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase">Cotización Flash</span>
                  <p className="font-bold text-white mt-1">Consorcio Torre Alvear</p>
                  <p className="text-[11px] text-slate-400">4 Domos AcuSense + NVR 4K</p>
                  <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold">
                    <span className="text-emerald-400">US$ 732,05</span>
                    <span className="text-indigo-400">Asig: Lucas</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                <span className="font-bold text-amber-400 block mb-2">3. En Negociación</span>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] font-bold text-amber-400 uppercase">Abono Monitoreo</span>
                  <p className="font-bold text-white mt-1">Fábrica Metalúrgica Sur</p>
                  <p className="text-[11px] text-slate-400">Alarma Garnet + Cerco 200m</p>
                  <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold">
                    <span className="text-emerald-400">US$ 3.400</span>
                    <span className="text-indigo-400">Asig: Juan</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-2">4. Ganado / A Instalar</span>
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Stock Reservado</span>
                  <p className="font-bold text-white mt-1">Colegio San Agustín</p>
                  <p className="text-[11px] text-slate-400">16 Cámaras IP Dahua + NVR</p>
                  <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold">
                    <span className="text-emerald-400">US$ 2.850</span>
                    <span className="text-emerald-300">✓ Listo pañol</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MÓDULO 6: TICKETS DE SOPORTE & SLA ───────────────────────── */}
      <section id="tickets" className="py-20 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-10 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Módulo 06 · Postventa & Soporte Técnico
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Tickets de Soporte: Seguimiento con SLA y responsable asignado
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              <strong>El dolor que elimina:</strong> Clientes que llaman furiosos porque una cámara no transmite o la alarma dispara falsos avisos y nadie sabe quién fue el técnico asignado. Tickets automáticos desde WhatsApp o portal con control de SLA.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-white">Tickets de Soporte</h3>
                <p className="text-xs text-slate-400">Seguimiento de cada reclamo y consulta, con SLA y responsable</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-300">Link de soporte</button>
                <button className="px-4 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-bold text-white shadow">+ Nuevo Ticket</button>
              </div>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm">6</div>
                <div><span className="text-xs font-bold block">Abiertos</span><span className="text-[10px] text-slate-400">En gestión</span></div>
              </div>
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm">4</div>
                <div><span className="text-xs font-bold block">Vencidos</span><span className="text-[10px] text-slate-400">Requieren acción</span></div>
              </div>
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">0</div>
                <div><span className="text-xs font-bold block">Esperando cliente</span><span className="text-[10px] text-slate-400">Pausados</span></div>
              </div>
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">6</div>
                <div><span className="text-xs font-bold block">Resueltos</span><span className="text-[10px] text-slate-400">Conformidad OK</span></div>
              </div>
            </div>

            {/* Ticket List */}
            <div className="space-y-2.5 text-xs">
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center justify-between border-l-4 border-red-500">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-slate-400">#8008</span>
                    <strong className="text-slate-900 text-sm">Cámaras sin conexión</strong>
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px]">Abierto</span>
                    <span className="px-2 py-0.5 rounded bg-red-500 text-white font-bold text-[10px]">SLA Vencido</span>
                  </div>
                  <p className="text-slate-500 text-xs">El cliente reporta que las cámaras no se ven en la app. Origen: Recibido por NISSI (bot de WhatsApp).</p>
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg">Técnico: David N.</span>
              </div>

              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center justify-between border-l-4 border-emerald-500">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-slate-400">#8010</span>
                    <strong className="text-slate-900 text-sm">Consulta de facturación y pagos</strong>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px]">Resuelto</span>
                  </div>
                  <p className="text-slate-500 text-xs">Envío automático del link al portal de autogestión para descargar Factura A. Origen: NISSI.</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">Admin: Natalia R.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MÓDULO 7: DEPÓSITO, STOCK & REMITOS ───────────────────────── */}
      <section id="stock" className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-10 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
              <Package className="w-4 h-4 text-amber-400" />
              Módulo 07 · Depósito & Entregas
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Stock Real & Conteo Inicial sin Factura de Compra
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              <strong>El dolor que elimina:</strong> Tener 30 cámaras en la estantería pero no poder venderlas porque el sistema contable te bloquea si no cargaste la factura vieja. Con JustCRM contás tus estanterías, ingresás el stock en 1 clic y queda listo para cotizar.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Depósito Central · Inventario Físico</h3>
                <p className="text-xs text-slate-400">Stock físico, stock reservado para obras y disponibilidad real</p>
              </div>
              <button className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow">
                <Sparkles className="w-3.5 h-3.5" /> Conteo Físico Inicial (Sin Factura)
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Código SKU / MPN</th>
                    <th className="p-3">Producto / Modelo</th>
                    <th className="p-3">Marca</th>
                    <th className="p-3 text-center">Físico</th>
                    <th className="p-3 text-center">Reservado</th>
                    <th className="p-3 text-center">Disponible</th>
                    <th className="p-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  <tr>
                    <td className="p-3 font-mono text-indigo-300 font-bold">DS-2CD2123G2-I</td>
                    <td className="p-3 font-bold text-white">Domo IP Hikvision AcuSense 2MP 2.8mm</td>
                    <td className="p-3 text-slate-400">Hikvision</td>
                    <td className="p-3 text-center font-bold">24</td>
                    <td className="p-3 text-center text-amber-400 font-bold">4</td>
                    <td className="p-3 text-center text-emerald-400 font-black text-sm">20</td>
                    <td className="p-3 text-right"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Stock Óptimo</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-indigo-300 font-bold">DS-7608NI-K2/8P</td>
                    <td className="p-3 font-bold text-white">NVR Grabador 8 Canales PoE 4K</td>
                    <td className="p-3 text-slate-400">Hikvision</td>
                    <td className="p-3 text-center font-bold">6</td>
                    <td className="p-3 text-center text-amber-400 font-bold">1</td>
                    <td className="p-3 text-center text-emerald-400 font-black text-sm">5</td>
                    <td className="p-3 text-right"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Stock Óptimo</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              💡 <strong>Órdenes de Entrega (`/entregas`):</strong> Cuando una cotización se aprueba, con 1 clic se emite el remito de pañol con la lista exacta de cada componente de los kits vendidos para que el técnico no olvide nada en la instalación.
            </div>
          </div>
        </div>
      </section>

      {/* ── MÓDULO 8: WHATSAPP IA & TOMA HUMANA ──────────────────────── */}
      <section id="whatsapp" className="py-20 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-10 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
              <Bot className="w-4 h-4 text-emerald-400" />
              Módulo 08 · WhatsApp Oficial con IA (NISSI)
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Respuesta en 2 segundos: El cliente nunca más espera
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              <strong>El dolor que elimina:</strong> Prospectos que piden presupuesto un sábado a las 19 hs y para cuando el vendedor les contesta el lunes al mediodía, ya compraron en otro lado. NISSI atiende 24/7 y deriva al vendedor con transcript completo.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              <div className="lg:col-span-4 bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Bandeja Oficial WhatsApp</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Meta Oficial</span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-600/10 border border-indigo-500/30">
                  <div className="flex justify-between items-start mb-1 text-xs">
                    <strong className="text-white">Distribuidora San Martín</strong>
                    <span className="text-slate-400 text-[10px]">18:42</span>
                  </div>
                  <p className="text-[11px] text-slate-300">"Necesitamos 8 cámaras para galpón..."</p>
                  <span className="inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-500 text-white">
                    Lead Creado en Pipeline
                  </span>
                </div>
              </div>

              <div className="lg:col-span-8 bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between h-[360px]">
                <div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-3">
                    <span className="text-xs font-bold text-white">Chat con el Cliente · Atendido por: NISSI (Gemini 2.5)</span>
                    <button className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400 shadow">
                      Tomar Conversación (Humano)
                    </button>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="bg-slate-900 p-3 rounded-xl rounded-tl-none border border-slate-800 max-w-[80%] text-slate-200">
                      "Hola, necesitamos poner 8 cámaras en un galpón de logística para control de camiones."
                    </div>
                    <div className="bg-emerald-950/40 border border-emerald-500/30 p-3.5 rounded-xl rounded-tr-none ml-auto max-w-[85%] text-emerald-200">
                      "¡Buenas tardes! Para galpones te recomendamos cámaras <strong>IP Varifocales Hikvision de 4MP</strong> para lectura de patentes más domos fijos internos. Ya derivo tu requerimiento a nuestro especialista comercial junto al proyecto."
                      <span className="text-[9px] text-emerald-400/60 block text-right mt-1">NISSI (IA) · 18:42:02 ✓✓</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                  ⚡ Oportunidad creada automáticamente en el Pipeline de Ventas con el chat adjunto en notas.
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── MÓDULO 9: DOCUMENTOS CENTRALIZADOS ───────────────────────── */}
      <section id="documentos" className="py-20 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-10 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5 mb-2">
              <Folder className="w-4 h-4 text-purple-400" />
              Módulo 09 · Gestor Documental de la Empresa
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Contratos, Cotizaciones y Facturas de Compra en un solo lugar
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              <strong>El dolor que elimina:</strong> Archivos perdidos en carpetas locales de Windows, contratos extraviados y garantías que nadie encuentra cuando un cliente hace un reclamo.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Documentos · 3 carpetas · 25 archivos</h3>
                <p className="text-xs text-slate-400">PDFs, contratos, imágenes y facturas de compra respaldadas en la nube</p>
              </div>
              <button className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow flex items-center gap-1.5">
                <HardDriveDownload className="w-3.5 h-3.5" /> Subir Archivo
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">CONTRATOS DE ABONO</h4>
                  <p className="text-[10px] text-slate-400">Monitoreo 24/7 y service</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">COTIZACIONES PDF</h4>
                  <p className="text-[10px] text-slate-400">Historial congelado emitido</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs">FACTURAS DE COMPRA</h4>
                  <p className="text-[10px] text-slate-400">Proveedores y mayoristas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MATRIZ DE ROLES & PERMISOS GRANULARES ─────────────────────── */}
      <section className="py-20 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-12 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 mb-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              Soberanía de Datos
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Cada usuario ve exactamente lo que le corresponde
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              Los vendedores solo ven sus propios clientes y cotizaciones, protegiendo tus márgenes comerciales y tu base de datos si alguien se va de la empresa.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-7 shadow-2xl text-left overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3 text-left">Módulo / Permiso</th>
                  <th className="p-3 text-center">Super Admin</th>
                  <th className="p-3 text-center">Gerente de Ventas</th>
                  <th className="p-3 text-center">Vendedor</th>
                  <th className="p-3 text-center">Técnico / Instalador</th>
                  <th className="p-3 text-center">Administración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                <tr>
                  <td className="p-3 font-bold text-white">Dashboard Financiero & MRR</td>
                  <td className="p-3 text-center text-emerald-400">✓ Total</td>
                  <td className="p-3 text-center text-emerald-400">✓ Total</td>
                  <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                  <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                  <td className="p-3 text-center text-emerald-400">✓ Total</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Cotizador Flash & Precios Gremio</td>
                  <td className="p-3 text-center text-emerald-400">✓ Total</td>
                  <td className="p-3 text-center text-emerald-400">✓ Total</td>
                  <td className="p-3 text-center text-emerald-400">✓ Total</td>
                  <td className="p-3 text-center text-slate-600">✕ Solo lectura</td>
                  <td className="p-3 text-center text-emerald-400">✓ Total</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Pipeline de Oportunidades</td>
                  <td className="p-3 text-center text-emerald-400">✓ Toda la empresa</td>
                  <td className="p-3 text-center text-emerald-400">✓ Todo el equipo</td>
                  <td className="p-3 text-center text-indigo-400 font-bold">Solo sus propios tratos</td>
                  <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                  <td className="p-3 text-center text-slate-600">✕ Solo lectura</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Depósito & Conteo Inicial</td>
                  <td className="p-3 text-center text-emerald-400">✓ Total</td>
                  <td className="p-3 text-center text-slate-400">Solo stock libre</td>
                  <td className="p-3 text-center text-slate-400">Solo stock libre</td>
                  <td className="p-3 text-center text-emerald-400">✓ Órdenes de entrega</td>
                  <td className="p-3 text-center text-emerald-400">✓ Ajustes y compras</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-white">Facturación AFIP / ARCA & CAE</td>
                  <td className="p-3 text-center text-emerald-400">✓ Total</td>
                  <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                  <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                  <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                  <td className="p-3 text-center text-emerald-400">✓ Emisión legal</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── PLANES DE SUSCRIPCIÓN ─────────────────────────────────────── */}
      <section id="planes" className="py-24 bg-slate-950 border-t border-slate-800 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Planes Transparentes</span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-2">
              Planes claros y adaptados a tu escala
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Menos de lo que perdés con una sola venta caída por demorarte en contestar.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto text-left">
            {/* Starter */}
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <h3 className="text-xl font-bold text-white">Starter Instalador</h3>
                <p className="text-xs text-slate-400 mt-1">Para técnicos independientes y equipos chicos de hasta 3 personas.</p>
                <div className="mt-6 mb-6">
                  <span className="text-3xl font-black text-white">Consultar</span>
                  <span className="text-xs text-slate-400 block mt-1">Planes a medida en pesos o dólares</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Hasta 3 usuarios incluidos</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Cotizador Flash ilimitado con PDF White-Clean</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Catálogo de 2.300+ productos & precios Gremio</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Pipeline de ventas Kanban</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Conteo inicial de stock sin factura</li>
                </ul>
              </div>
              <a
                href="#contacto"
                className="mt-8 w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center transition-all"
              >
                Solicitar Cotización Starter
              </a>
            </div>

            {/* Plan Pro con Bot IA (Destacado) */}
            <div className="rounded-3xl bg-gradient-to-b from-indigo-950/60 via-slate-900 to-slate-900 border-2 border-indigo-500 p-8 flex flex-col justify-between shadow-2xl relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-red-500 via-indigo-500 to-cyan-400 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow">
                MÁS ELEGIDO POR EMPRESAS
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Security Pro & Bot IA</h3>
                <p className="text-xs text-slate-300 mt-1">Para empresas de seguridad, monitoreo y CCTV que quieren escalar.</p>
                <div className="mt-6 mb-6">
                  <span className="text-3xl font-black text-white">Plan Pro</span>
                  <span className="text-xs text-indigo-300 block mt-1">Con Bot de WhatsApp NISSI Gemini 2.5</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-200">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> <strong>Usuarios ilimitados</strong> para todo el equipo</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> <strong>Bot NISSI WhatsApp con IA (Meta Oficial)</strong></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Derivación automática con transcript a Ventas/Soporte</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Inbox compartido de WhatsApp con Takeover humano</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Facturación electrónica oficial ARCA / AFIP</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Portal de autogestión de clientes</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Remitos y órdenes de entrega con código de componentes</li>
                </ul>
              </div>
              <a
                href="#contacto"
                className="mt-8 w-full py-4 rounded-xl bg-gradient-to-r from-red-500 via-indigo-600 to-cyan-500 hover:from-red-600 hover:to-indigo-600 text-white font-black text-xs text-center shadow-lg transition-all"
              >
                Comenzar con Plan Pro
              </a>
            </div>

            {/* Enterprise */}
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <h3 className="text-xl font-bold text-white">Enterprise White-Label</h3>
                <p className="text-xs text-slate-400 mt-1">Para grandes integradores, franquicias o múltiples depósitos.</p>
                <div className="mt-6 mb-6">
                  <span className="text-3xl font-black text-white">A Medida</span>
                  <span className="text-xs text-slate-400 block mt-1">Servidor privado dedicado + Marca blanca total</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Servidor privado en Hetzner / AWS</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Dominio propio (crm.tuempresa.com)</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Múltiples sucursales / depósitos aislados</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Integraciones personalizadas por API</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Soporte prioritario directo con ingenieros</li>
                </ul>
              </div>
              <a
                href="#contacto"
                className="mt-8 w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center transition-all"
              >
                Contactar a Ventas Enterprise
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ Section ──────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Preguntas Frecuentes</span>
            <h2 className="text-3xl font-black text-white mt-2">
              Todo lo que necesitás saber antes de dar el salto
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden text-left">
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

      {/* ── Contact Form ──────────────────────────────────────────────── */}
      <section id="contacto" className="py-24 bg-gradient-to-b from-[#070b14] to-slate-950 border-t border-slate-800 text-center px-4">
        <div className="max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-500 via-indigo-600 to-cyan-400 flex items-center justify-center mx-auto mb-5 shadow-xl">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Terminá con el Caos Hoy</h2>
          <p className="text-slate-400 text-sm mb-8">
            Completá tus datos y un especialista técnico de JustCreate te contactará hoy mismo para mostrarte el sistema en vivo adaptado a tu empresa.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              alert('¡Gracias! Un especialista técnico de JustCreate se pondrá en contacto a la brevedad.')
            }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-left space-y-4 shadow-2xl"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre y Apellido</label>
              <input
                type="text"
                required
                placeholder="Ej. Juan Pérez"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Empresa</label>
              <input
                type="text"
                required
                placeholder="Ej. Seguridad Integral SRL"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="juan@empresa.com"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  required
                  placeholder="+54 9 11 ..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full mt-4 py-4 rounded-xl bg-gradient-to-r from-red-500 via-indigo-600 to-cyan-500 hover:from-red-600 hover:to-indigo-600 text-white font-black text-xs shadow-lg transition-all"
            >
              Agendar Demostración Personalizada
            </button>
          </form>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="py-10 bg-slate-950 border-t border-slate-900 text-slate-500 text-xs text-center sm:text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>JustCRM · Desarrollado con orgullo por <a href="https://justcreate.com.ar" target="_blank" rel="noreferrer" className="text-slate-300 hover:text-white underline">JustCreate</a></p>
          <p>© 2026 JustCRM. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
