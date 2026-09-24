'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Shield, Zap, Bot, FileText, BarChart3, Layers, Package, Users,
  CheckCircle2, ArrowRight, Play, Clock, Sparkles, Send, Check,
  ChevronDown, PhoneCall, AlertTriangle, Eye, RefreshCw, X,
  TrendingUp, DollarSign, Calendar, MessageSquare, Flame, CheckCheck,
  Receipt, ArrowUpRight, Laptop, Smartphone, Lock, Folder, Download,
  Search, Filter, Plus, UserCheck, HelpCircle, HardDriveDownload,
  Truck, ShoppingCart, CalendarDays, MapPin, ClipboardList, Camera, LogIn,
  Building2, CreditCard, Star, QrCode, ShieldCheck, ExternalLink, Briefcase,
  Navigation, Radio, CheckSquare, Award, ThumbsUp, Compass, Sliders, Settings,
  Globe, Menu
} from 'lucide-react'

export default function LandingPage() {
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD')
  const [priceMode, setPriceMode] = useState<'GREMIO' | 'PUBLICO'>('GREMIO')
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactCompany, setContactCompany] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const faqs = [
    {
      q: '¿Por qué JustCRM es superior frente a un CRM tradicional para empresas de seguridad y servicios técnicos?',
      a: 'Los CRMs tradicionales (HubSpot, Zoho, Salesforce) son genéricos y no entienden la operativa real: no cotizan kits con componentes desglosados para pañol, no manejan listas duales de Gremio vs Público, no permiten cargar stock físico sin factura previa, y no gestionan remitos de entrega ni órdenes de trabajo en vivo para tus cuadrillas. Con JustCRM tenés todo resuelto en una sola plataforma.'
    },
    {
      q: '¿Cómo funciona el Bot de WhatsApp con IA y cómo interactúa con el catálogo?',
      a: 'El Bot con IA corre sobre el motor Gemini 2.5 Flash de Google, conectado a la API oficial de WhatsApp de Meta. El bot comprende lenguaje natural, conoce todo tu catálogo técnico (cámaras IP vs analógicas, analítica AcuSense, distancias infrarrojas, centrales de alarma). Jamás inventa un precio: cuando detecta intención de compra o soporte, califica al cliente y lo deriva de inmediato con todo el historial de la conversación pegado en la ficha del Pipeline o Mesa de Ayuda.'
    },
    {
      q: '¿Qué pasa si un vendedor o asesor quiere responder en vivo por WhatsApp?',
      a: 'El CRM cuenta con una bandeja de entrada compartida oficial. Con un solo clic en "Tomar conversación", el humano toma el control total del chat y la IA se silencia automáticamente para ese hilo. Cuando el operador termina, puede devolver el control al bot con un botón o el sistema lo reactiva automáticamente a las 24 horas.'
    },
    {
      q: '¿Puedo cargar mi stock actual si no tengo las facturas de compra anteriores a mano?',
      a: 'Sí, 100%. Desarrollamos el módulo exclusivo de "Conteo Físico Inicial": contás físicamente lo que tenés en tus estanterías (cámaras, cables, sensores, fuentes) e ingresás el inventario real en 1 clic para que los vendedores puedan cotizar inmediatamente.'
    },
    {
      q: '¿Cómo se maneja la gestión de abonos mensuales de monitoreo o servicios recurrentes?',
      a: 'JustCRM posee un módulo nativo de Servicios Recurrentes (MRR / ARR). Permite gestionar contratos periódicos en pesos o dólares, controlar renovaciones a 30, 60 y 90 días, registrar cobranzas y mantener las cuentas corrientes al día sin planillas paralelas.'
    },
    {
      q: '¿Cómo protegen la privacidad de los clientes y evitan que los vendedores se lleven los contactos?',
      a: 'El sistema cuenta con una matriz de roles estricta. Los Vendedores (`SELLER`) solo tienen visibilidad sobre sus propios tratos, prospectos y cotizaciones. Todo el historial de chats y llamadas queda en el CRM oficial, garantizando que la información le pertenezca a la empresa.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-indigo-500 selection:text-white font-poppins antialiased overflow-x-hidden">
      
      {/* ── Top Navigation: Cápsula Flotante Glass / Floating Island Dock ──── */}
      <header className="sticky top-3 sm:top-5 z-50 px-3 sm:px-6 transition-all">
        <div className="max-w-5xl mx-auto rounded-full bg-white/95 backdrop-blur-xl border border-white/80 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.1)] px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo Principal Original */}
          <a href="#inicio" className="flex items-center transition-transform hover:scale-[1.02] shrink-0">
            <img src="/Logo-sin-fondo.png" alt="JustCRM Logo" className="h-8 sm:h-9 w-auto object-contain" />
          </a>

          {/* Menú Principal Limpio & Editorial */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-medium text-slate-700">
            <a href="#inicio" className="hover:text-[#00628e] transition-colors">
              Inicio
            </a>

            <a href="#funciones" className="text-[#00628e] font-semibold hover:text-[#00496b] transition-colors">
              Funciones
            </a>

            <a href="#planes" className="hover:text-[#00628e] transition-colors">
              Planes
            </a>

            <a href="#faq" className="hover:text-[#00628e] transition-colors">
              Preguntas
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* INGRESO PARA CLIENTES */}
            <Link
              href="/login"
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-white font-medium text-xs tracking-normal shadow-sm flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 shrink-0 bg-[#00628e] hover:bg-[#00496b]"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-200" />
              <span>Ingreso Clientes</span>
            </Link>
            <a
              href="#contacto"
              className="text-xs font-medium px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all transform hover:-translate-y-0.5 flex items-center gap-1 shrink-0"
            >
              <span>Solicitar Demo</span>
              <ArrowRight className="w-3 h-3" />
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 ml-0.5 transition-all"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Drawer Móvil Flotante */}
        {mobileMenuOpen && (
          <div className="md:hidden max-w-5xl mx-auto mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl p-4 space-y-2.5 text-sm shadow-2xl">
            <a
              href="#inicio"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-medium text-slate-700 hover:text-[#00628e] py-1"
            >
              Inicio
            </a>
            <a
              href="#funciones"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-medium text-[#00628e] hover:text-[#00496b] py-1"
            >
              Funciones del CRM (Resumen por Área)
            </a>
            <a
              href="#dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs text-slate-500 hover:text-[#00628e] pl-3 py-0.5"
            >
              → Ver los 18 Módulos del Sistema
            </a>
            <a
              href="#planes"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-medium text-slate-700 hover:text-[#00628e] py-1"
            >
              Planes de Suscripción
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-medium text-slate-700 hover:text-[#00628e] py-1"
            >
              Preguntas Frecuentes
            </a>
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3.5 rounded-full text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md bg-[#00628e] hover:bg-[#00496b]"
              >
                <LogIn className="w-4 h-4 text-cyan-200" />
                <span>Ingreso Clientes</span>
              </Link>
              <a
                href="#contacto"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 flex items-center justify-center gap-2 hover:bg-slate-200"
              >
                <span>Solicitar Demo en Vivo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ── SECCIÓN 1: INICIO & PROPUESTA DE VALOR ───────────────────────── */}
      <section id="inicio" className="relative pt-16 pb-20 md:pt-24 md:pb-24 overflow-hidden text-center">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-gradient-to-tr from-[#035b7e]/30 via-[#00496b]/20 to-[#05a3e1]/25 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700/80 text-xs font-medium text-cyan-300 mb-8 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block shrink-0"></span>
            <span>Optimizá la gestión interna y pulverizá los tiempos de respuesta</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-white max-w-5xl mx-auto leading-[1.05] mb-6">
            Achicá el caos operativo. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-300 to-white">
              Dispará la productividad de tu equipo.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-8 font-normal">
            El ecosistema todo-en-uno que conecta tus <strong className="text-white font-medium">ventas</strong>, tus <strong className="text-white font-medium">técnicos en obra</strong> y tu <strong className="text-white font-medium">administración</strong>. Cotizaciones en 30 segundos, WhatsApp con IA 24/7, catálogo mayorista, compras con OCR, remitos de entrega y control milimétrico de tareas y depósito.
          </p>

          {/* Banner de Acceso Rápido para Clientes Existentes - BIEN GRANDE Y DESTACADO */}
          <div
            className="inline-flex items-center gap-3 px-6 sm:px-8 py-3.5 rounded-full border backdrop-blur-xl mb-10 shadow-lg flex-wrap justify-center animate-landing-fade-in bg-[#00496b]/30 border-cyan-400/30"
          >
            <span className="flex h-3 w-3 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
            </span>
            <span className="text-sm sm:text-base text-slate-100 font-medium">
              ¿Ya sos cliente o usuario de JustCRM?
            </span>
            <Link
              href="/login"
              className="px-5 py-2 rounded-full text-white font-medium text-xs sm:text-sm tracking-normal shadow-md flex items-center gap-2 transition-all transform hover:scale-105 bg-[#00628e] hover:bg-[#00496b] border border-cyan-400/40 shrink-0"
            >
              <LogIn className="w-4 h-4 text-cyan-300" />
              <span>Ingreso para Clientes →</span>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <a
              href="#contacto"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#00628e] hover:bg-[#00496b] text-white font-medium text-base shadow-lg shadow-[#00628e]/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3 border border-cyan-400/30"
            >
              <span>Agendar Demostración Personalizada</span>
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#funciones"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white font-medium text-base border border-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>Ver Funciones Principales</span>
            </a>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tiempo de Respuesta</span>
                <p className="text-xl sm:text-2xl font-semibold text-emerald-400 mt-0.5">2 Segundos</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Atención con IA 24/7</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cotización Flash</span>
                <p className="text-xl sm:text-2xl font-semibold text-cyan-400 mt-0.5">30 Segundos</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">PDF White-Clean en vivo</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Automatización</span>
                <p className="text-base sm:text-lg font-semibold text-amber-400 mt-0.5 leading-snug">Mejora tu productividad</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Automatiza procesos · Centraliza toda tu gestión</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Control & Seguridad</span>
                <p className="text-base sm:text-lg font-semibold text-indigo-400 mt-0.5 leading-snug">Usuarios y Privilegios</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Permisos granulares por área y jerarquía</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2: INTRODUCCIÓN A LAS FUNCIONES (Una debajo de la otra) ── */}
      <section id="funciones" className="py-20 bg-[#0a0f1d] border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Introducción Breve · Qué hace JustCRM
            </span>
            <h2 className="text-3xl sm:text-5xl font-semibold text-white leading-tight">
              Las funciones que transforman cada área, <span className="text-cyan-400">una debajo de la otra</span>.
            </h2>
            <p className="text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
              Un único software que reúne y conecta a tus vendedores, tus técnicos instaladores, tu administración y la gerencia general con un solo objetivo: <strong>cero fricción operativa y respuesta instantánea</strong>.
            </p>
          </div>

          {/* Lista Vertical de Funciones: Una debajo de la otra */}
          <div className="space-y-6">

            {/* Función 1: Vendedores & Ventas */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-semibold shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">Área Comercial · Para Vendedores</span>
                    <h3 className="text-lg sm:text-xl font-semibold text-white">Cotizador Flash en 30s, Catálogo Propio Dual & Pipeline Kanban</h3>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-bold border border-amber-500/20 self-start sm:self-center">
                  Ventas Rápidas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed mb-4">
                <div>
                  <strong className="text-white block mb-1">¿Qué función cumple en el día a día?</strong>
                  <p>
                    Permite a cualquier vendedor armar un presupuesto técnico complejo en <strong>30 segundos cronometrados</strong>. Accede a tu catálogo propio de artículos y servicios con cálculo automático de costo gremio vs precio de venta al público en <strong>dólares oficiales, MEP o pesos</strong>. Emite un <strong>PDF White-Clean con token seguro</strong> de aprobación online y organiza todos los tratos en un <strong>Pipeline Kanban</strong>.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <strong className="text-red-400 block mb-1">El dolor que elimina de raíz:</strong>
                  <p className="text-slate-400">
                    Elimina la pérdida de clientes por demorarse <strong>48 horas en redactar una cotización en Word o Excel</strong>, los errores en la conversión cambiaria y los presupuestos olvidados sin seguimiento de los asesores.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 text-[11px]">Módulos detallados: #03 Catálogo Propio · #04 Cotizador Flash · #05 Pipeline Kanban</span>
                <a href="#cotizador" className="text-amber-400 font-bold hover:underline flex items-center gap-1">
                  Ver pantalla del Cotizador →
                </a>
              </div>
            </div>

            {/* Función 2: Prospectos & WhatsApp IA */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-semibold shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Atención al Cliente · Para Prospectos & Consultas</span>
                    <h3 className="text-lg sm:text-xl font-semibold text-white">WhatsApp Oficial con IA (Gemini 2.5) & Bandeja Compartida</h3>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-bold border border-emerald-500/20 self-start sm:self-center">
                  Respuesta en 2s
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed mb-4">
                <div>
                  <strong className="text-white block mb-1">¿Qué función cumple en el día a día?</strong>
                  <p>
                    Conectado directamente a la <strong>API Oficial de Meta</strong>, nuestro agente inteligente <strong>con IA comprende consultas técnicas complejas</strong> (distingue cámaras IP vs HDCVI, centrales de alarma, distancias infrarrojas). <strong>Responde en 2 segundos las 24 horas</strong>, asesora con productos de tu catálogo, califica el interés de compra y <strong>deriva al cliente al vendedor adecuado con todo el transcript de la charla pegado en su ficha</strong>. Además, permite <strong>tomar control humano instantáneo</strong> con 1 clic.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <strong className="text-red-400 block mb-1">El dolor que elimina de raíz:</strong>
                  <p className="text-slate-400">
                    Termina con los prospectos que escriben a las 20:00 hs o un domingo y <strong>se van con la competencia al no recibir respuesta inmediata</strong>; y evita que los vendedores usen sus celulares privados perdiendo trazabilidad.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 text-[11px]">Módulos detallados: #12 WhatsApp IA · #10 Mesa de Ayuda & SLAs</span>
                <a href="#whatsapp" className="text-emerald-400 font-bold hover:underline flex items-center gap-1">
                  Ver demo de WhatsApp con IA →
                </a>
              </div>
            </div>

            {/* Función 3: Técnicos & Pañol */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-semibold shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">Operaciones & Obras · Para Instaladores y Pañol</span>
                    <h3 className="text-lg sm:text-xl font-semibold text-white">App Móvil 'Mi Día', Remitos de Entrega y Conteo Físico sin Factura</h3>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 text-xs font-bold border border-cyan-500/20 self-start sm:self-center">
                  Cero Papel
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed mb-4">
                <div>
                  <strong className="text-white block mb-1">¿Qué función cumple en el día a día?</strong>
                  <p>
                    Cada técnico accede a su <strong>panel móvil 'Mi Día'</strong> desde su smartphone sin instalar APKs pesadas: hace <strong>fichaje con GPS</strong>, abre la dirección en Waze o Google Maps en 1 toque, sigue el checklist de instalación estandarizado y <strong>sube fotos del rack terminado con firma digital</strong> del encargado. En pañol, cada remito de entrega <strong>descarga los componentes exactos del stock físico</strong>, y contás con la función exclusiva de <strong>cargar inventario inicial sin requerir facturas de compra previas</strong>.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <strong className="text-red-400 block mb-1">El dolor que elimina de raíz:</strong>
                  <p className="text-slate-400">
                    Instaladores llamando 10 veces por día a administración pidiendo teléfonos, materiales que salen del pañol y se esfuman sin remito, y la imposibilidad de cotizar por no tener cargadas las facturas viejas de compra.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 text-[11px]">Módulos detallados: #06 Tareas · #07 Remitos · #11 Conteo Inicial · #17 App 'Mi Día'</span>
                <a href="#mi-dia" className="text-cyan-400 font-bold hover:underline flex items-center gap-1">
                  Ver pantalla Móvil del Técnico →
                </a>
              </div>
            </div>

            {/* Función 4: Gerencia & Socios */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-semibold shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">Gerencia & Dirección · Para Propietarios y Socios</span>
                    <h3 className="text-lg sm:text-xl font-semibold text-white">Dashboard Ejecutivo en Vivo, Ficha 360° y Matriz de Roles</h3>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-xs font-bold border border-purple-500/20 self-start sm:self-center">
                  Control Total
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed mb-4">
                <div>
                  <strong className="text-white block mb-1">¿Qué función cumple en el día a día?</strong>
                  <p>
                    Visualización en un solo <strong>Dashboard Ejecutivo de la actividad comercial, avance de obras y niveles de stock</strong> en tiempo real. <strong>Ficha 360° inmutable</strong> con todo el historial de conversaciones, presupuestos aprobados y remitos firmados por cliente, junto a una <strong>matriz de permisos que blinda tus contactos de clientes</strong> para que ningún vendedor se lleve tu base de datos.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <strong className="text-red-400 block mb-1">El dolor que elimina de raíz:</strong>
                  <p className="text-slate-400">
                    Tener que esperar a fin de mes para saber si la empresa gana dinero, el desfasaje entre lo que vende comercial y lo que instala el técnico, y el riesgo constante de fuga de clientes cuando un empleado renuncia.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 text-[11px]">Módulos detallados: #01 Dashboard · #02 Ficha 360° · #15 Roles y Blindaje</span>
                <a href="#dashboard" className="text-purple-400 font-bold hover:underline flex items-center gap-1">
                  Ver Dashboard Ejecutivo →
                </a>
              </div>
            </div>

          </div>

          {/* Caja de Conversión: Solicitar una Demo o Contacto */}
          <div className="mt-12 p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 blur-[100px] pointer-events-none rounded-full" />
            
            <span className="text-xs font-medium uppercase tracking-wider text-cyan-400 block mb-2">
              Paso Siguiente · Demostración en Vivo
            </span>
            <h3 className="text-2xl sm:text-4xl font-semibold text-white max-w-2xl mx-auto leading-tight mb-3">
              ¿Querés ver cómo funciona todo esto en vivo para tu empresa?
            </h3>
            <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed mb-8 font-normal">
              Agendá una demostración guiada de 15 minutos con un especialista de JustCreate. Te mostramos cómo cargar tu catálogo, cómo atiende el bot de WhatsApp y cómo cotizar en 30 segundos.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#contacto"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#00628e] hover:bg-[#00496b] text-white font-medium text-sm shadow-lg shadow-[#00628e]/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 border border-cyan-400/30"
              >
                <span>Solicitar una Demo o Contacto</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href="#dashboard"
                className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-medium text-sm border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <span>Explorar los 18 Módulos en Detalle ↓</span>
              </a>
            </div>
          </div>

          {/* Matriz de Acceso Directo a los 18 Módulos */}
          <div className="mt-14 pt-8 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Plataforma Completa</span>
                <h4 className="text-sm sm:text-base font-semibold text-white">Navegación Rápida por los 18 Módulos del Sistema</h4>
              </div>
              <span className="text-xs text-indigo-400 font-bold">Clic para ir a la pantalla ↓</span>
            </div>

            <div className="flex flex-wrap gap-2 justify-start">
              {[
                { id: 'dashboard', n: '01', t: 'Dashboard Ejecutivo', c: 'text-red-400 border-red-500/20' },
                { id: 'clientes', n: '02', t: 'Ficha 360° Clientes', c: 'text-cyan-400 border-cyan-500/20' },
                { id: 'catalogo', n: '03', t: 'Catálogo Propio Dual', c: 'text-amber-400 border-amber-500/20' },
                { id: 'cotizador', n: '04', t: 'Cotizador Flash 30s', c: 'text-emerald-400 border-emerald-500/20' },
                { id: 'pipeline', n: '05', t: 'Pipeline Kanban', c: 'text-cyan-400 border-cyan-500/20' },
                { id: 'tareas', n: '06', t: 'Tareas Operativas', c: 'text-purple-400 border-purple-500/20' },
                { id: 'entregas', n: '07', t: 'Remitos de Pañol', c: 'text-amber-400 border-amber-500/20' },
                { id: 'compras', n: '08', t: 'Compras con OCR', c: 'text-cyan-400 border-cyan-500/20' },
                { id: 'servicios', n: '09', t: 'Abonos MRR Monitoreo', c: 'text-emerald-400 border-emerald-500/20' },
                { id: 'tickets', n: '10', t: 'Tickets SLA & Mesa', c: 'text-red-400 border-red-500/20' },
                { id: 'stock', n: '11', t: 'Stock & Conteo Inicial', c: 'text-amber-400 border-amber-500/20' },
                { id: 'whatsapp', n: '12', t: 'WhatsApp Oficial con IA', c: 'text-emerald-400 border-emerald-500/20' },
                { id: 'campo', n: '13', t: 'Visitas Técnicas & GPS', c: 'text-cyan-400 border-cyan-500/20' },
                { id: 'documentos', n: '14', t: 'Gestor Documental', c: 'text-purple-400 border-purple-500/20' },
                { id: 'roles', n: '15', t: 'Matriz de Permisos', c: 'text-indigo-400 border-indigo-500/20' },
                { id: 'portal-gremio', n: '16', t: 'Portal B2B Gremio', c: 'text-amber-400 border-amber-500/20' },
                { id: 'mi-dia', n: '17', t: 'App Móvil "Mi Día"', c: 'text-emerald-400 border-emerald-500/20' },
                { id: 'onboarding', n: '18', t: 'Setup en 15 Minutos', c: 'text-cyan-400 border-cyan-500/20' }
              ].map((m) => (
                <a
                  key={m.id}
                  href={`#${m.id}`}
                  className={`px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border ${m.c} text-xs font-semibold flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5`}
                >
                  <span className="font-mono text-[10px] opacity-70">{m.n}.</span>
                  <span className="text-white hover:text-white">{m.t}</span>
                </a>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SÁBANA COMPLETA DE MÓDULOS RECREADOS DEL SISTEMA               */}
      {/* ════════════════════════════════════════════════════════════════ */}

      {/* ── MÓDULO 1: DASHBOARD EJECUTIVO (Pattern A: Texto + Beneficios a la izquierda, Mockup a la derecha) ── */}
      <section id="dashboard" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5 mb-2">
                  <BarChart3 className="w-4 h-4 text-red-400" />
                  Módulo 01 · Dashboard Ejecutivo en Vivo
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  El pulso financiero y operativo de tu empresa, <span className="text-red-400">al segundo</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Dashboard Ejecutivo de JustCRM</strong> consolida en una sola pantalla todas las variables críticas de tu negocio: <strong>facturación mensual</strong>, <strong>ingresos recurrentes por abonos de monitoreo (MRR)</strong>, <strong>estado de cobranzas</strong> y <strong>avance de obras técnicas</strong>.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Cada vez que un vendedor cotiza, un técnico cierra una instalación o se confirma un remito de entrega, los gráficos se recalculan en tiempo real. Esto permite al directorio y a la gerencia general <strong>tomar decisiones estratégicas inmediatas</strong> basadas en datos fehacientes.
              </p>

              <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-red-400 block mb-1">El dolor que elimina de raíz:</strong>
                Termina con la <strong>ceguera gerencial</strong> y las 15 planillas de Excel desactualizadas. Ya no tenés que llamar al contador ni esperar al día 30 para saber si tu empresa ganó dinero o si tenés facturas en riesgo de incobrabilidad.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-bold text-xs">Control MRR</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Proyección exacta de <strong>abonos de monitoreo</strong> y servicios continuos.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-bold text-xs">Cobranzas 100%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Detección inmediata de <strong>facturas vencidas</strong> antes de acumular deuda.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-bold text-xs">Ticket Promedio</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Medí la <strong>rentabilidad por cliente</strong> y detectá oportunidades de venta.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="font-bold text-xs">Cero Excel</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Toda la empresa conectada a una <strong>única base de datos en tiempo real</strong>.</p>
                </div>
              </div>
            </div>

            {/* Right: Rich UI Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Dashboard Ejecutivo</h3>
                    <p className="text-xs text-slate-400">Resumen integral en tiempo real</p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 inline-block"></span> En jornada · 01:06 p. m.
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm">
                    <span className="text-2xl font-semibold block">34</span>
                    <span className="text-[11px] text-slate-500 font-bold mt-0.5 block">Clientes Activos</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm relative">
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      ↗ 100%
                    </span>
                    <span className="text-xl font-semibold text-emerald-600 block mt-1">$ 1.934.400</span>
                    <span className="text-[11px] text-slate-500 font-bold mt-0.5 block">Ingresos del Mes</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm">
                    <span className="text-2xl font-semibold text-amber-500 block">0</span>
                    <span className="text-[11px] text-slate-500 font-bold mt-0.5 block">Pagos Pendientes</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm">
                    <span className="text-2xl font-semibold text-red-500 block">0</span>
                    <span className="text-[11px] text-slate-500 font-bold mt-0.5 block">Facturas Vencidas</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-4">
                  <div className="sm:col-span-8 p-4 rounded-2xl bg-white text-slate-900 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">Ingresos Recurrentes (MRR)</h4>
                        <p className="text-[10px] text-slate-400">Abonos de monitoreo y servicios mensuales</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Últimos 6 meses</span>
                    </div>
                    <div className="h-32 w-full flex items-end">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
                        <path d="M 0,140 Q 200,135 350,110 T 500,20" fill="none" stroke="#ef4444" strokeWidth="4" />
                        <path d="M 0,140 Q 200,135 350,110 T 500,20 L 500,150 L 0,150 Z" fill="rgba(239, 68, 68, 0.08)" />
                        <circle cx="500" cy="20" r="5" fill="#ef4444" />
                      </svg>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono">
                      <span>abr</span><span>may</span><span>jun</span><span>jul</span><span>ago</span>
                      <span className="font-bold text-red-500">sept ($ 2.000k MRR)</span>
                    </div>
                  </div>

                  <div className="sm:col-span-4 p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between text-center">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 mb-1">Efectividad de Cobro</h4>
                      <div className="w-20 h-20 mx-auto rounded-full border-8 border-emerald-500 flex items-center justify-center my-2">
                        <span className="text-[10px] font-semibold text-emerald-600">100%</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600">Cobranzas al día</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Ingresos Anuales Estimados</span>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5 font-mono">$ 23.212.800</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400">Ticket Promedio por Cuenta</span>
                    <p className="text-lg font-bold text-cyan-400 mt-0.5 font-mono">$ 56.894</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 2: CLIENTES 360° (Pattern B: Mockup a la izquierda, Texto + Beneficios a la derecha) ── */}
      <section id="clientes" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Rich UI Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="p-5 rounded-2xl bg-white text-slate-900 mb-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center font-semibold text-xl shadow">
                        EC
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">Empresa de Servicios Corporativos</h3>
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">Cliente Activo</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">contacto@empresa-cliente.com · Eduardo Castex, La Pampa</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="px-3.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> + Cotizar
                      </button>
                      <button className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs">
                        Editar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 text-center">
                    <div><span className="text-lg font-semibold text-slate-900">2</span><span className="text-[10px] text-slate-400 block font-bold">Deals activos</span></div>
                    <div><span className="text-lg font-semibold text-emerald-600 font-mono">US$ 1.840</span><span className="text-[10px] text-slate-400 block font-bold">Valor esperado</span></div>
                    <div><span className="text-lg font-semibold text-slate-900">0</span><span className="text-[10px] text-slate-400 block font-bold">Tickets abiertos</span></div>
                    <div><span className="text-lg font-semibold text-slate-900">1</span><span className="text-[10px] text-slate-400 block font-bold">Tareas pending</span></div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white text-slate-900 shadow-sm">
                  <div className="flex gap-5 border-b border-slate-200 pb-3 mb-4 text-xs font-bold text-slate-500">
                    <span className="text-red-500 border-b-2 border-red-500 pb-3 -mb-3">Actividad</span>
                    <span>Deals (2)</span>
                    <span>Cotizaciones (3)</span>
                    <span>Tickets (0)</span>
                    <span>Tareas (1)</span>
                    <span>Contactos (2)</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 inline-block"></span>
                        <span className="font-bold text-slate-800 truncate">
                          Nota de Asesor Comercial · Sebastián P.
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">hace 2 horas</span>
                    </div>
                    <p className="text-slate-600 font-mono text-[11px] bg-white p-3 rounded-lg border border-slate-200 mt-2 leading-relaxed">
                      [13:10] Sebastián P: "Daniel, ¿cómo estás? Te paso el presupuesto de los 4 domos IP AcuSense con el NVR de 8 canales que charlamos por WhatsApp. Quedó aplicado el precio Gremio." <br />
                      [13:12] Cliente: "Recibido Sebastián, excelente presentación en PDF. Mañana lo aprobamos en la reunión de directorio."
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-1">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Módulo 02 · Ficha 360° del Cliente
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Toda la relación con tu cliente en una <span className="text-cyan-400">línea de tiempo inmutable</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                La <strong>Ficha 360° del Cliente</strong> es el registro definitivo de cada punto de contacto: <strong>mensajes de WhatsApp oficiales</strong>, <strong>presupuestos emitidos en PDF</strong>, <strong>órdenes de trabajo para técnicos</strong>, <strong>tickets de soporte</strong> y <strong>remitos de entrega firmados</strong>.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Permite registrar <strong>múltiples contactos por empresa</strong> (el decisor de compras, el encargado de tesorería y el vigilador de turno), adjuntar notas internas entre áreas y revisar el historial de presupuestos aprobados o rechazados.
              </p>

              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-cyan-400 block mb-1">El dolor que elimina de raíz:</strong>
                Destruye el riesgo de que la información quede <strong>atrapada en el celular personal del vendedor</strong>. Si un empleado renuncia o se enferma, cualquier compañero abre la ficha del cliente y retoma la conversación en <strong>menos de 5 segundos</strong> con contexto total.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Shield className="w-4 h-4" />
                    <span className="font-bold text-xs">Blindaje Comercial</span>
                  </div>
                  <p className="text-[11px] text-slate-400">La <strong>cartera y los acuerdos</strong> le pertenecen a tu empresa, no al empleado.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold text-xs">Historial Completo</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Visualizá cotizaciones, tickets y llamadas en un <strong>feed cronológico unificado</strong>.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <UserCheck className="w-4 h-4" />
                    <span className="font-bold text-xs">Contactos Clave</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Guardá al <strong>decisor de compras</strong>, al tesorero y al técnico de guardia.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="font-bold text-xs">Acceso Inmediato</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Botón de <strong>cotización directa</strong> precargando automáticamente los datos del cliente.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 3: CATÁLOGO COMERCIAL & PRECIOS GREMIO (Pattern A: Texto a la izquierda, Mockup a la derecha) ── */}
      <section id="catalogo" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  Módulo 03 · Catálogo Propio de Productos y Servicios
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Cargá tu catálogo propio con <span className="text-amber-400">listas duales de Gremio y Público</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Catálogo de JustCRM</strong> te permite estructurar y dar de alta todos los artículos y servicios propios de tu empresa con total flexibilidad. Carga tus productos con código SKU, descripciones técnicas, marcas y categorías adaptadas a tu negocio.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Maneja <strong>doble lista de precios en simultáneo</strong>: Precio Gremio (para técnicos e instaladores autorizados) y Precio Público Final. Soporta cotización en <strong>Dólares Estadounidenses (USD)</strong> y <strong>Pesos Argentinos (ARS)</strong>, con actualización instantánea según el tipo de cambio que definas.
              </p>

              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-amber-400 block mb-1">El dolor que elimina de raíz:</strong>
                Vendedores pasando precios obsoletos, buscando costos en planillas desactualizadas o <strong>vendiendo por debajo del margen mínimo</strong> permitido. Cada producto tiene sus márgenes de utilidad totalmente claros y protegidos.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Package className="w-4 h-4" />
                    <span className="font-bold text-xs">Carga Ilimitada</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Subí tus propios artículos, repuestos, kits y mano de obra con códigos SKU y categorías.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-bold text-xs">Precios Gremio</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Descuentos especiales automáticos para instaladores sin cálculos manuales.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Search className="w-4 h-4" />
                    <span className="font-bold text-xs">Búsqueda Rápida</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Encontrá repuestos y equipos al instante por código SKU, marca o categoría.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="font-bold text-xs">Margen Blindado</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El asesor no puede vender por debajo del costo mínimo de reposición.</p>
                </div>
              </div>
            </div>

            {/* Right: Rich UI Mockup */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-red-500 text-white font-bold text-xs shadow">
                      Hardware & Equipos
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs">
                      Servicios & Mano de Obra
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      disabled
                      value="Hikvision, Dahua, Garrett, TP-Link..."
                      className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-4 py-2 text-xs text-slate-300 w-56 sm:w-64"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="h-14 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">FIBRA</div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">FIBRA ÓPTICA</span>
                      <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">(0135501080) TP-LINK SFP 1.25G</p>
                    </div>
                    <span className="mt-2 pt-2 border-t border-slate-100 font-semibold text-emerald-700 font-mono">Gremio US$ 22,84</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="h-14 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">KIT MON</div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">MONITOREO</span>
                      <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">Transmisor 4G FRS Alarma</p>
                    </div>
                    <span className="mt-2 pt-2 border-t border-slate-100 font-semibold text-emerald-700 font-mono">Gremio US$ 140,00</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="h-14 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">GARRETT</div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">DETECTOR</span>
                      <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">Garrett Super Scanner</p>
                    </div>
                    <span className="mt-2 pt-2 border-t border-slate-100 font-semibold text-emerald-700 font-mono">Gremio US$ 434,30</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="h-14 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">DAHUA</div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">XVR 16CH</span>
                      <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">16 Ch Penta-Brid 5M-N</p>
                    </div>
                    <span className="mt-2 pt-2 border-t border-slate-100 font-semibold text-emerald-700 font-mono">Gremio US$ 215,00</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="h-14 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">SOYAL</div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700">ACCESOS</span>
                      <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">16 Puertas TCP/IP Soyal</p>
                    </div>
                    <span className="mt-2 pt-2 border-t border-slate-100 font-semibold text-emerald-700 font-mono">Gremio US$ 320,00</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="h-14 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs mb-2">HIKVISION</div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">PORTERÍA</span>
                      <p className="font-bold text-[11px] text-slate-900 mt-1 leading-tight line-clamp-2">Accesorio Montaje Empotrable</p>
                    </div>
                    <span className="mt-2 pt-2 border-t border-slate-100 font-semibold text-emerald-700 font-mono">Gremio US$ 72,96</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 4: COTIZADOR FLASH & PDF WHITE-CLEAN (Pattern B: Mockup a la izquierda, Texto a la derecha) ── */}
      <section id="cotizador" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Rich UI Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Lista:</span>
                    <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
                      <button
                        onClick={() => setPriceMode('GREMIO')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold ${priceMode === 'GREMIO' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
                      >
                        Gremio
                      </button>
                      <button
                        onClick={() => setPriceMode('PUBLICO')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold ${priceMode === 'PUBLICO' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        Público
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Moneda:</span>
                    <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
                      <button
                        onClick={() => setCurrency('USD')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold ${currency === 'USD' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        USD
                      </button>
                      <button
                        onClick={() => setCurrency('ARS')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold ${currency === 'ARS' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        ARS ($ 1.280)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white text-slate-900 p-5 shadow-inner border border-slate-200">
                  <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-semibold text-base">
                        ST
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-slate-900 leading-tight">SECURETECH SEGURIDAD ELECTRÓNICA</h4>
                        <p className="text-[10px] text-slate-500 font-medium">CCTV · Alarmas · Redes · Control de Accesos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider">
                        PRESUPUESTO OFICIAL
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">Ref: PRESUP-2026-ST · 24/09/2026</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-12 text-[10px] font-bold text-slate-500 uppercase pb-1 border-b border-slate-200">
                      <div className="col-span-6">Ítem & Código SKU</div>
                      <div className="col-span-2 text-center">Tipo</div>
                      <div className="col-span-2 text-center">Cant.</div>
                      <div className="col-span-2 text-right">Total</div>
                    </div>

                    <div className="grid grid-cols-12 text-xs py-1.5 border-b border-slate-100 items-center">
                      <div className="col-span-6 pr-2">
                        <p className="font-bold text-slate-900 text-[11px]"><span className="text-indigo-600 font-mono">[DS-2CD2123G2-I]</span> Domo IP Hikvision AcuSense 2MP</p>
                      </div>
                      <div className="col-span-2 text-center"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">PRODUCTO</span></div>
                      <div className="col-span-2 text-center text-slate-600 font-medium">4 u.</div>
                      <div className="col-span-2 text-right font-bold text-slate-900 font-mono">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 340,00' : '$ 435.200') : (currency === 'USD' ? 'US$ 480,00' : '$ 614.400')}</div>
                    </div>

                    <div className="grid grid-cols-12 text-xs py-1.5 border-b border-slate-100 items-center">
                      <div className="col-span-6 pr-2">
                        <p className="font-bold text-slate-900 text-[11px]"><span className="text-indigo-600 font-mono">[DS-7608NI-K2/8P]</span> Grabador NVR 8CH PoE 4K</p>
                      </div>
                      <div className="col-span-2 text-center"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">PRODUCTO</span></div>
                      <div className="col-span-2 text-center text-slate-600 font-medium">1 u.</div>
                      <div className="col-span-2 text-right font-bold text-slate-900 font-mono">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 195,00' : '$ 249.600') : (currency === 'USD' ? 'US$ 270,00' : '$ 345.600')}</div>
                    </div>

                    <div className="grid grid-cols-12 text-xs py-1.5 border-b border-slate-100 items-center">
                      <div className="col-span-6 pr-2">
                        <p className="font-bold text-slate-900 text-[11px]"><span className="text-amber-600 font-mono">[KIT-CONEX-04]</span> Kit Baluns + Fuentes + UTP</p>
                      </div>
                      <div className="col-span-2 text-center"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">KIT</span></div>
                      <div className="col-span-2 text-center text-slate-600 font-medium">1 kit</div>
                      <div className="col-span-2 text-right font-bold text-slate-900 font-mono">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 70,00' : '$ 89.600') : (currency === 'USD' ? 'US$ 95,00' : '$ 121.600')}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <div className="w-56 bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal Neto:</span>
                        <span className="font-bold font-mono">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 605,00' : '$ 774.400') : (currency === 'USD' ? 'US$ 845,00' : '$ 1.081.600')}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>IVA (21%):</span>
                        <span className="font-mono">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 127,05' : '$ 162.624') : (currency === 'USD' ? 'US$ 177,45' : '$ 227.136')}</span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 flex justify-between text-sm font-semibold text-indigo-700">
                        <span>TOTAL:</span>
                        <span className="font-mono">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 732,05' : '$ 937.024') : (currency === 'USD' ? 'US$ 1.022,45' : '$ 1.308.736')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px]">⚡ Envío directo por email y WhatsApp al cliente.</span>
                  <button className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow">
                    <Send className="w-3.5 h-3.5" /> Enviar PDF al Cliente
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Módulo 04 · Cotizador Flash en 30 Segundos
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Presupuestos corporativos en PDF <span className="text-emerald-400">mientras hablás por teléfono</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Cotizador Flash de JustCRM</strong> es la herramienta de cierre más potente de tu equipo de ventas. Permite armar una cotización técnica completa con <strong>desglose de equipos, códigos SKU, descripciones técnicas y cálculo automático de IVA</strong> en menos de medio minuto.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Genera un <strong>PDF corporativo de diseño White-Clean</strong> con tu logotipo en alta resolución, validez de la oferta (7 o 15 días para protegerte de la inflación) y botón de envío directo por correo y WhatsApp con un solo clic.
              </p>

              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-emerald-400 block mb-1">El dolor que elimina de raíz:</strong>
                Presupuestos que tardaban <strong>45 minutos en armarse en Word o Excel</strong> con tablas desalineadas y cálculos manuales de alícuotas. Quien responde primero la solicitud de presupuesto, <strong>se queda con el 78% de las ventas</strong>.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold text-xs">30 Segundos</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Cotizá en vivo durante la llamada y <strong>cerrá la venta en caliente</strong>.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Download className="w-4 h-4" />
                    <span className="font-bold text-xs">PDF White-Clean</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Diseño institucional de máximo nivel para <strong>consorcios y empresas</strong>.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Layers className="w-4 h-4" />
                    <span className="font-bold text-xs">Kits Desglosados</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El cliente ve el kit y el pañol recibe la <strong>lista exacta de cables y fuentes</strong>.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Send className="w-4 h-4" />
                    <span className="font-bold text-xs">Envío en 1 Clic</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Sin descargar ni adjuntar manualmente: <strong>directo al correo del cliente</strong>.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 5: PIPELINE COMERCIAL KANBAN (Pattern A: Texto a la izquierda, Mockup a la derecha) ── */}
      <section id="pipeline" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Módulo 05 · Pipeline Comercial Kanban
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Embudo de oportunidades drag & drop: <span className="text-cyan-400">cero tratos olvidados</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Pipeline Comercial Kanban de JustCRM</strong> ofrece una panorámica visual de cada operación en curso. Desde que un prospecto entra atendido por el <strong>bot de WhatsApp con IA</strong> hasta que la instalación se concreta, cada tarjeta representa dinero real en juego.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Podés arrastrar y soltar las oportunidades entre etapas (<strong>Nuevo Lead IA</strong>, <strong>Cotización Enviada</strong>, <strong>En Negociación</strong> y <strong>Ganado / Listo Pañol</strong>), asignar vendedores responsables y proyectar los ingresos mensuales con un cálculo probabilístico de cierre.
              </p>

              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-cyan-400 block mb-1">El dolor que elimina de raíz:</strong>
                Oportunidades que mueren por falta de seguimiento. Cuando un vendedor maneja 20 presupuestos en su cabeza o en libretas de papel, <strong>el 40% de los clientes se enfrían y compran a la competencia</strong>. El pipeline emite alertas automáticas de inactividad.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-bold text-xs">Forecast Real</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Sabé con precisión <strong>cuánto dinero va a ingresar</strong> este mes según el avance de tratos.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Bot className="w-4 h-4" />
                    <span className="font-bold text-xs">Leads de WhatsApp IA</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Los prospectos de WhatsApp entran <strong>automáticamente a la etapa 1</strong> sin tipear.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold text-xs">Alertas de Demora</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Avisos si un presupuesto enviado lleva <strong>más de 48 horas sin seguimiento</strong>.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="font-bold text-xs">Asignación Clara</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Cada tarjeta tiene un <strong>asesor comercial responsable</strong> con nombre y apellido.</p>
                </div>
              </div>
            </div>

            {/* Right: Rich UI Mockup */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white">Pipeline de Oportunidades</h3>
                    <p className="text-[11px] text-slate-400">Total en curso: <strong className="text-emerald-400 font-mono">US$ 28.450</strong> · 18 tratos</p>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-bold">Equipo Comercial</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                    <span className="font-bold text-slate-400 block mb-2 text-[11px]">1. Nuevo Lead (IA)</span>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase">WhatsApp IA</span>
                      <p className="font-bold text-white mt-1">Galpón Logística 8 Cámaras</p>
                      <p className="text-[10px] text-slate-400">Distribuidora San Martín</p>
                      <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold text-[10px]">
                        <span className="text-slate-400 font-mono">Est: US$ 1.840</span>
                        <span className="text-indigo-400">Asig: Juan</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-2xl p-3 border border-indigo-500/30">
                    <span className="font-bold text-indigo-400 block mb-2 text-[11px]">2. Cotización Enviada</span>
                    <div className="p-3 rounded-xl bg-slate-900 border border-indigo-500/20">
                      <span className="text-[9px] font-bold text-indigo-400 uppercase">Cotizador Flash</span>
                      <p className="font-bold text-white mt-1">Consorcio Las Torres</p>
                      <p className="text-[10px] text-slate-400">4 Domos AcuSense + NVR 4K</p>
                      <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold text-[10px]">
                        <span className="text-emerald-400 font-mono">US$ 732,05</span>
                        <span className="text-indigo-400">Asig: Lucas</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                    <span className="font-bold text-amber-400 block mb-2 text-[11px]">3. En Negociación</span>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[9px] font-bold text-amber-400 uppercase">Abono Monitoreo</span>
                      <p className="font-bold text-white mt-1">Fábrica Metalúrgica Sur</p>
                      <p className="text-[10px] text-slate-400">Alarma Garnet + Cerco 200m</p>
                      <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold text-[10px]">
                        <span className="text-emerald-400 font-mono">US$ 3.400</span>
                        <span className="text-indigo-400">Asig: Juan</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-2xl p-3 border border-emerald-500/30">
                    <span className="font-bold text-emerald-400 block mb-2 text-[11px]">4. Ganado / A Instalar</span>
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase">Stock Reservado</span>
                      <p className="font-bold text-white mt-1">Colegio San Agustín</p>
                      <p className="text-[10px] text-slate-400">16 Cámaras IP Dahua + NVR</p>
                      <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold text-[10px]">
                        <span className="text-emerald-400 font-mono">US$ 2.850</span>
                        <span className="text-emerald-300">✓ Listo pañol</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 6: GESTIÓN DE TAREAS OPERATIVAS & TÉCNICAS (Pattern B: Mockup a la izquierda, Texto a la derecha) ── */}
      <section id="tareas" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Rich UI Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 font-bold text-xs border border-purple-500/30">
                      Órdenes de Trabajo Activas (8)
                    </span>
                    <span className="text-xs text-slate-400">Filtrar por: <strong>Técnico / Urgencia</strong></span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 inline-block"></span>
                    <span>Cuadrillas en campo: 4</span>
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Tarea 1: Urgente */}
                  <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm border-l-4 border-red-500">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">Urgente</span>
                        <span className="text-slate-400 font-mono text-[10px]">#OT-8921</span>
                        <strong className="text-sm font-bold text-slate-900">Configuración NVR & Hik-Connect</strong>
                      </div>
                      <span className="text-red-600 font-bold text-[11px] font-mono">Vence Hoy 17:00</span>
                    </div>
                    <p className="text-slate-600 text-xs">Consorcio Las Torres · Vincular 4 celulares de los administradores y verificar grabación 24/7 en disco 2TB.</p>
                    
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">Técnico: Lucas M.</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-500">Obra: CCTV Cocheras</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">✓ Checklist 3/4</span>
                        <span className="text-indigo-600 font-bold underline cursor-pointer">Ver detalle</span>
                      </div>
                    </div>
                  </div>

                  {/* Tarea 2: Alta */}
                  <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm border-l-4 border-amber-500">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">Prioridad Alta</span>
                        <span className="text-slate-400 font-mono text-[10px]">#OT-8924</span>
                        <strong className="text-sm font-bold text-slate-900">Tendido de Fibra Óptica & Conectores SFP</strong>
                      </div>
                      <span className="text-amber-600 font-bold text-[11px] font-mono">Mañana 09:30</span>
                    </div>
                    <p className="text-slate-600 text-xs">Galpón Logística San Martín · Fusionar enlaces de fibra en rack central y certificar switches PoE 10G.</p>
                    
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">Técnico: Marcos R.</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-500">Pañol: Remito #0412 OK</span>
                      </div>
                      <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">Pendiente de inicio</span>
                    </div>
                  </div>

                  {/* Tarea 3: Completada */}
                  <div className="p-4 rounded-2xl bg-slate-900/90 text-slate-200 border border-slate-800 border-l-4 border-l-emerald-500">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Completada</span>
                        <span className="text-slate-500 font-mono text-[10px]">#OT-8910</span>
                        <strong className="text-sm font-bold text-white">Relevamiento Perimetral con Dron</strong>
                      </div>
                      <span className="text-emerald-400 font-bold text-[11px]">Ayer 16:45</span>
                    </div>
                    <p className="text-slate-400 text-xs">Fábrica Metalúrgica Sur · 200m de cerco eléctrico relevados. Plano con puntos ciegos adjuntado.</p>
                    <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-[11px]">
                      <span className="text-slate-400">Técnico: Sebastián P.</span>
                      <span className="text-emerald-400 font-bold">✓ Informe técnico subido al legajo de cliente</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5 mb-2">
                  <ClipboardList className="w-4 h-4 text-purple-400" />
                  Módulo 06 · Tareas Operativas & Órdenes de Trabajo
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Coordinación milimétrica entre ventas, pañol y campo: <span className="text-purple-400">cero malentendidos</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Módulo de Tareas Operativas de JustCRM</strong> es el centro de mando de tus cuadrillas de instalación y service. Al aprobarse una venta o al dispararse una solicitud de soporte técnico, el sistema genera <strong>órdenes de trabajo automáticas con checklist obligatorio</strong>, responsable asignado y fecha límite ineludible.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Cada técnico recibe en su teléfono celular la <strong>hoja de ruta precisa</strong>: marcas de equipos a instalar, contraseñas de configuración, croquis de montaje y materiales que debe retirar de pañol. Ningún trabajo se marca como concluido sin completar las <strong>verificaciones técnicas y subir las fotos de prueba</strong>.
              </p>

              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-purple-400 block mb-1">El dolor que elimina de raíz:</strong>
                El clásico <strong>"teléfono descompuesto"</strong>: el comercial promete una instalación en 24 horas con 5 cámaras y enlace inalámbrico, pero técnica no tiene el detalle, el instalador viaja sin las fuentes adecuadas y el cliente llama furioso. Con JustCRM, <strong>cada instrucción queda documentada y con trazabilidad absoluta</strong>.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-purple-400 mb-1">
                    <CheckSquare className="w-4 h-4" />
                    <span className="font-bold text-xs">Checklists Estrictos</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Verificación paso a paso (enfoque, PoE, grabación) antes de cerrar la tarea.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold text-xs">Control de Tiempos</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Horas hombre reales vs. tiempos presupuestados para medir rentabilidad por obra.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-bold text-xs">Alertas de Demora</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Avisos inmediatos a gerencia si una orden crítica se aproxima a su límite de vencimiento.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Camera className="w-4 h-4" />
                    <span className="font-bold text-xs">Evidencia Fotográfica</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El instalador adjunta fotos del rack, cámaras y cables prolijos para conformidad.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 7: ENTREGAS & LOGÍSTICA DE PAÑOL (Pattern A: Texto a la izquierda, Mockup a la derecha) ── */}
      <section id="entregas" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  Módulo 07 · Remitos de Entrega & Pañol Central
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Despiece exacto de kits y control de materiales: <span className="text-amber-400">ni un tornillo de menos</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Módulo de Remitos y Pañol de JustCRM</strong> resuelve el mayor cuello de botella en instalaciones de seguridad electrónica: el <strong>despiece automático de kits en insumos unitarios</strong>. Cuando se aprueba un "Kit de 4 Cámaras", el pañolero no ve un título genérico, sino la <strong>orden de preparación fraccionada</strong> con 4 domos, 1 NVR, 1 disco 2TB, 8 baluns, 4 fuentes y los metros exactos de cable UTP exterior.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Cada salida de pañol descuenta automáticamente las unidades del <strong>stock físico</strong>, asigna el material a la obra correspondiente y genera el <strong>remito oficial numerado con firma digital de recepción</strong> por parte del instalador o cliente final.
              </p>

              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-amber-400 block mb-1">El dolor que elimina de raíz:</strong>
                Instaladores perdiendo medio día en el cliente porque faltaron conectores BNC o fuentes de 12V, o pañoleros acusando a los técnicos de extraviar mercadería. <strong>Cada tornillo, bobina y cámara queda registrada con firma y número de remito</strong>.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Layers className="w-4 h-4" />
                    <span className="font-bold text-xs">Despiece de Kits</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Convierte ítems comerciales en insumos de pañol fraccionados al instante.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <QrCode className="w-4 h-4" />
                    <span className="font-bold text-xs">Firma de Recepción</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El técnico o cliente firma digitalmente el remito en pantalla táctil o papel.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Package className="w-4 h-4" />
                    <span className="font-bold text-xs">Descuento Físico</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Salida de mercadería que impacta en el stock real sin esperar la factura contable.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="font-bold text-xs">Remito Validador</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Comprobante numerado con trazabilidad legal para auditorías de obra.</p>
                </div>
              </div>
            </div>

            {/* Right: Rich UI Mockup */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800 text-xs">
                  <div>
                    <strong className="text-white text-sm">Remito Oficial de Salida #REM-2026-0412</strong>
                    <p className="text-[11px] text-slate-400">Depósito Central · Salida a Obra</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    En Preparación / Despiece OK
                  </span>
                </div>

                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-xs space-y-2 mb-4">
                  <div className="flex justify-between py-1.5 border-b border-slate-900 text-slate-200">
                    <span className="font-mono text-indigo-300">4× [DS-2CD2123G2-I]</span>
                    <span className="font-bold">Domo IP Hikvision AcuSense 2MP</span>
                    <span className="text-emerald-400 font-bold">✓ En caja</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-900 text-slate-200">
                    <span className="font-mono text-indigo-300">1× [DS-7608NI-K2/8P]</span>
                    <span className="font-bold">Grabador NVR 8 Ch PoE 4K</span>
                    <span className="text-emerald-400 font-bold">✓ En caja</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-900 text-slate-200">
                    <span className="font-mono text-indigo-300">1× [WD20PURZ]</span>
                    <span className="font-bold">Disco Rígido 2TB WD Purple CCTV</span>
                    <span className="text-emerald-400 font-bold">✓ Montado en NVR</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-slate-200">
                    <span className="font-mono text-amber-300">8× Baluns + 4 Fuentes</span>
                    <span className="font-bold">Insumos de Conexión + 100m UTP Ext.</span>
                    <span className="text-emerald-400 font-bold">✓ Fraccionado</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  <div>
                    <span className="text-slate-400 text-[10px] block">DESTINO & CLIENTE</span>
                    <strong className="text-white">Consorcio Las Torres</strong>
                    <p className="text-slate-400 text-[11px]">Av. del Libertador 4450 · CABA</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">RETIRA / TÉCNICO RESPONSABLE</span>
                    <strong className="text-indigo-400">Lucas Martínez (Móvil 04)</strong>
                    <p className="text-slate-400 text-[11px]">DNI: 35.849.201 · Firma Registrada</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400 text-[11px]">Firma digital requerida antes de despachar del pañol.</span>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700">
                      <Download className="w-3.5 h-3.5" /> Descargar PDF
                    </button>
                    <button className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow">
                      <Send className="w-3.5 h-3.5" /> Confirmar Entrega
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 8: COMPRAS CON OCR & CUENTAS POR PAGAR (Pattern B: Mockup a la izquierda, Texto a la derecha) ── */}
      <section id="compras" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Rich UI Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">DISTRIBUIDORA MAYORISTA SEGURIDAD S.A.</h4>
                        <p className="text-[10px] text-slate-500">CUIT: 30-71289410-4 · Factura A Nº 0004-00012845</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Comprobante Verificado (OK)
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase pb-1 border-b">
                      <div className="col-span-6">Producto Detectado por OCR</div>
                      <div className="col-span-2 text-center">Cant.</div>
                      <div className="col-span-2 text-right">Costo Unit.</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                    </div>
                    <div className="grid grid-cols-12 py-1 border-b border-slate-100 items-center text-[11px]">
                      <div className="col-span-6 font-bold text-slate-800">[DS-2CD2123G2-I] Domo IP Hikvision 2MP</div>
                      <div className="col-span-2 text-center text-slate-600">10 u.</div>
                      <div className="col-span-2 text-right font-mono font-bold text-slate-900">US$ 54,20</div>
                      <div className="col-span-2 text-right font-mono font-bold text-slate-900">US$ 542,00</div>
                    </div>
                    <div className="grid grid-cols-12 py-1 border-b border-slate-100 items-center text-[11px]">
                      <div className="col-span-6 font-bold text-slate-800">[DS-7608NI-K2/8P] Grabador NVR 8CH 4K</div>
                      <div className="col-span-2 text-center text-slate-600">3 u.</div>
                      <div className="col-span-2 text-right font-mono font-bold text-slate-900">US$ 142,00</div>
                      <div className="col-span-2 text-right font-mono font-bold text-slate-900">US$ 426,00</div>
                    </div>
                    <div className="grid grid-cols-12 py-1 items-center text-[11px]">
                      <div className="col-span-6 font-bold text-slate-800">[WD20PURZ] Disco Western Digital Purple 2TB</div>
                      <div className="col-span-2 text-center text-slate-600">5 u.</div>
                      <div className="col-span-2 text-right font-mono font-bold text-slate-900">US$ 61,00</div>
                      <div className="col-span-2 text-right font-mono font-bold text-slate-900">US$ 305,00</div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-[11px] text-slate-500">Total Comprobante: <strong>US$ 1.273,00</strong></span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">✓ Confianza IA: 99.8%</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400 text-[11px]">Suma 18 unidades al stock y recalcula precios de venta en el catálogo.</span>
                  <button className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow">
                    <Zap className="w-3.5 h-3.5" /> Aprobar e Ingresar a Stock
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-2">
                  <ShoppingCart className="w-4 h-4 text-cyan-400" />
                  Módulo 08 · Compras Mayoristas & OCR Inteligente
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Ingreso de comprobantes de proveedores con IA: <span className="text-cyan-400">cero tipeo manual</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Módulo de Compras con OCR de JustCRM</strong> elimina por completo la pesada carga manual de comprobantes de mayoristas o distribuidores. Subí el archivo PDF o sacale una foto con tu teléfono celular.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                El motor de <strong>Inteligencia Artificial y OCR</strong> lee los datos en segundos: <strong>número de comprobante, proveedor, fecha, alícuotas e importes</strong> y todos los códigos SKU de los productos comprados, actualizando los costos de reposición y aumentando el stock de pañol automáticamente.
              </p>

              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-cyan-400 block mb-1">El dolor que elimina de raíz:</strong>
                La secretaria o el encargado de compras pasando <strong>3 horas diarias tiroteando facturas de 50 ítems a mano en el sistema contable</strong>, con errores de precios de costo que luego arruinan los márgenes de venta. Con IA, el proceso toma <strong>5 segundos con 99.8% de precisión</strong>.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Camera className="w-4 h-4" />
                    <span className="font-bold text-xs">Lectura con IA</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Escaneo de PDFs y fotos de facturas o remitos con digitalización instantánea de ítems.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-bold text-xs">Actualiza Costos</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Recalcula tus precios gremio y público para mantener siempre tu margen neto.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Package className="w-4 h-4" />
                    <span className="font-bold text-xs">Stock Inmediato</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Suma las unidades a tus almacenes y pañoles sin necesidad de reingreso manual.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <CreditCard className="w-4 h-4" />
                    <span className="font-bold text-xs">Cuentas por Pagar</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Agenda de vencimientos a 30, 45 y 60 días para aprovechar descuentos por pronto pago.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 9: ABONOS MENSUALES & SERVICIOS RECURRENTES (Pattern A: Texto a la izquierda, Mockup a la derecha) ── */}
      <section id="servicios" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  Módulo 09 · Servicios Recurrentes (MRR & ARR)
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Cobro recurrente de monitoreo 24/7 y mantenimiento: <span className="text-emerald-400">ingresos previsibles</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Módulo de Servicios Recurrentes de JustCRM</strong> es el motor de rentabilidad estable para empresas de seguridad electrónica, monitoreo de alarmas y mantenimiento IOT. Permite gestionar cientos o miles de <strong>contratos mensuales, trimestrales y anuales</strong> con actualización periódica de tarifas.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Maneja contratos multimoneda (<strong>ARS y USD</strong>) y cuenta con un potente <strong>generador de liquidaciones periódicas por lotes</strong>: el día 1 de cada mes podés procesar cientos de abonos y enviar los estados de cuenta y resúmenes de servicio por correo electrónico y WhatsApp de forma 100% desatendida.
              </p>

              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-emerald-400 block mb-1">El dolor que elimina de raíz:</strong>
                Tener a personas de administración dedicando la primera semana del mes exclusivamente a <strong>revisar planillas de cálculo manuales</strong>, olvidando aplicar aumentos inflacionarios acordados o dejando abonados sin liquidar durante meses por falta de control centralizado.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-bold text-xs">MRR en Vivo</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Visualizá tu facturación mensual recurrente fija y proyectada al centavo.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="font-bold text-xs">Liquidación en Lote</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Procesá cientos de liquidaciones de abonos y estados de cuenta con 1 solo clic.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-bold text-xs">Ajuste por Inflación</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Actualizaciones masivas de tarifas de abono sin editar contrato por contrato.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold text-xs">Alertas de Vencimiento</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Detección temprana de contratos próximos a vencer para gestionar renovaciones.</p>
                </div>
              </div>
            </div>

            {/* Right: Rich UI Mockup */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">MRR Total Mensual</span>
                    <p className="text-xl font-semibold text-emerald-400 mt-1 font-mono">$ 14.850.000</p>
                    <p className="text-[10px] text-slate-400">+ US$ 4.200 USD</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Abonados Activos</span>
                    <p className="text-xl font-semibold text-white mt-1">182 Cuentas</p>
                    <p className="text-[10px] text-emerald-400">99.2% Cobranza al día</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">A Vencer (30 Días)</span>
                    <p className="text-xl font-semibold text-amber-400 mt-1">14 Contratos</p>
                    <p className="text-[10px] text-slate-400">Renovación automática</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2 mb-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                    <strong className="text-white text-xs">Lote de Liquidación Mensual de Abonos #LOTE-09-2026</strong>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">Listo para emitir</span>
                  </div>
                  <div className="flex justify-between text-slate-300 py-1">
                    <span>182 Liquidaciones y Estados de Cuenta Listos</span>
                    <span className="font-mono font-bold text-white">$ 14.850.000 + US$ 4.200</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px] py-1">
                    <span>Envío programado de avisos y resúmenes de cuenta</span>
                    <span className="text-emerald-400 font-bold">✓ Habilitado</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex flex-wrap justify-between items-center gap-3">
                  <span className="text-[11px]">⚡ <strong>Liquidación Masiva en 1 Clic:</strong> Procesa todos los abonos recurrentes y envía resúmenes por WhatsApp.</span>
                  <button className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow">
                    Ejecutar Lote Mensual
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 10: TICKETS & SLA (Pattern B: Mockup a la izquierda, Texto a la derecha) ── */}
      <section id="tickets" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Rich UI Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">6</div>
                    <div><span className="text-xs font-bold block">Abiertos</span><span className="text-[10px] text-slate-400">En gestión</span></div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">4</div>
                    <div><span className="text-xs font-bold block">Vencidos</span><span className="text-[10px] text-slate-400">Acción ya</span></div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">0</div>
                    <div><span className="text-xs font-bold block">En Espera</span><span className="text-[10px] text-slate-400">Cliente</span></div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">12</div>
                    <div><span className="text-xs font-bold block">Resueltos</span><span className="text-[10px] text-slate-400">100% OK</span></div>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-wrap items-center justify-between border-l-4 border-red-500 gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-slate-400 text-[10px]">#8008</span>
                        <strong className="text-slate-900 text-sm">Cámaras sin conexión en Cocheras</strong>
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px]">Crítico</span>
                        <span className="px-2 py-0.5 rounded bg-red-500 text-white font-bold text-[10px] font-mono">SLA Vencido (00:45)</span>
                      </div>
                      <p className="text-slate-500 text-xs">Consorcio Las Torres · Origen: Reportado automáticamente por la IA en WhatsApp.</p>
                    </div>
                    <span className="text-xs font-bold text-red-700 bg-red-50 px-3 py-1 rounded-xl border border-red-200">
                      Técnico: David N.
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-wrap items-center justify-between border-l-4 border-emerald-500 gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-slate-400 text-[10px]">#8010</span>
                        <strong className="text-slate-900 text-sm">Consulta de Estado de Cuenta y Abono</strong>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px]">Resuelto</span>
                      </div>
                      <p className="text-slate-500 text-xs">Fábrica Metalúrgica Sur · El Bot con IA envió automáticamente el estado de cuenta y comprobante al cliente.</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                      Auto-Resuelto IA
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Módulo 10 · Mesa de Ayuda Técnica & SLAs
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Control estricto de tiempos de respuesta: <span className="text-red-400">cada reclamo tiene dueño</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                La <strong>Mesa de Ayuda Técnica de JustCRM</strong> convierte los reclamos caóticos en un flujo estructurado con <strong>acuerdos de nivel de servicio (SLA)</strong> rigurosos. Ya sea que el ticket ingrese por el portal de autogestión, por el <strong>bot inteligente con IA en WhatsApp</strong> o por vía telefónica, el sistema le asigna un número de caso único, un nivel de criticidad y un técnico de guardia responsable.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                El cronómetro de SLA mide en tiempo real el <strong>tiempo hasta la primera respuesta</strong> y el <strong>tiempo total de resolución</strong>. Si un reclamo crítico (como la caída de un enlace de CCTV bancario o una central de alarma bloqueada) no es atendido en el plazo acordado, el sistema escala automáticamente una alerta de emergencia al jefe de técnica.
              </p>

              <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-red-400 block mb-1">El dolor que elimina de raíz:</strong>
                Clientes corporativos llamando furiosos al dueño de la empresa porque un sensor falla hace 3 días y <strong>nadie sabe quién tenía que ir a revisarlo</strong>. Con JustCRM no existen tickets en el limbo ni derivaciones perdidas.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-red-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold text-xs">Cronómetro SLA</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Tiempos límite de atención garantizados según el tipo de abono del cliente.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Bot className="w-4 h-4" />
                    <span className="font-bold text-xs">Tickets de WhatsApp</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El Bot con IA genera el ticket y asocia los audios y fotos recibidos de inmediato.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-bold text-xs">Escalado Crítico</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Alerta de emergencia al director si un cliente corporativo sufre corte de servicio.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-bold text-xs">Conformidad Final</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El ticket solo se cierra cuando el cliente confirma que el servicio está 100% restablecido.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 11: DEPÓSITO & CONTEO INICIAL (Pattern A: Texto a la izquierda, Mockup a la derecha) ── */}
      <section id="stock" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  Módulo 11 · Depósito & Stock Real
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Conteo físico inicial sin factura: <span className="text-amber-400">empezá a cotizar ya</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Módulo de Depósito y Conteo Inicial de JustCRM</strong> derriba la traba número 1 de los sistemas contables tradicionales: la exigencia de cargar facturas de compra anteriores para habilitar el stock para la venta. Si tenés 20 cámaras en la estantería o 5 bobinas de cable en el pañol, <strong>ingresás el conteo físico en 1 clic y el stock queda disponible de inmediato</strong>.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Distingue con total claridad entre <strong>Stock Físico Real</strong> (lo que está en la estantería), <strong>Stock Reservado</strong> (comprometido en cotizaciones ganadas u órdenes de trabajo en curso) y <strong>Stock Libre Disponible</strong> para nuevas ventas. Además, emite <strong>alertas de reposición crítica</strong> cuando un insumo cae por debajo del punto de pedido.
              </p>

              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-amber-400 block mb-1">El dolor que elimina de raíz:</strong>
                Vendedores prometiendo a un cliente 6 cámaras de seguridad que en realidad ya estaban reservadas para otra obra, o no poder cotizar productos que tenés en mano porque <strong>el sistema contable los bloquea hasta que encuentres una factura de hace tres meses</strong>.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-bold text-xs">Conteo en 1 Clic</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Habilitá tu inventario en minutos cargando lo que ves en tus estanterías.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Layers className="w-4 h-4" />
                    <span className="font-bold text-xs">Stock Reservado</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Protege los materiales asignados a obras confirmadas para no revenderlos.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-red-400 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-bold text-xs">Alerta de Quiebre</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Avisos automáticos a compras antes de quedarte sin insumos críticos.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Building2 className="w-4 h-4" />
                    <span className="font-bold text-xs">Multi-Almacén</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Controlá simultáneamente el pañol central, camionetas y depósitos remotos.</p>
                </div>
              </div>
            </div>

            {/* Right: Rich UI Mockup */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white">Inventario Físico · Depósito Central</h3>
                    <p className="text-[11px] text-slate-400">Balance en vivo entre físico, comprometido y disponible</p>
                  </div>
                  <button className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow">
                    <Sparkles className="w-3.5 h-3.5" /> Conteo Inicial (Sin Factura)
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 overflow-x-auto text-xs">
                  <table className="w-full text-left min-w-[500px]">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="p-3">Código SKU / MPN</th>
                        <th className="p-3">Producto / Modelo</th>
                        <th className="p-3 text-center">Físico</th>
                        <th className="p-3 text-center">Reservado</th>
                        <th className="p-3 text-center">Disponible</th>
                        <th className="p-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                      <tr>
                        <td className="p-3 font-mono text-indigo-300 font-bold">DS-2CD2123G2-I</td>
                        <td className="p-3 font-bold text-white text-[11px]">Domo IP Hikvision AcuSense 2MP</td>
                        <td className="p-3 text-center font-bold">24</td>
                        <td className="p-3 text-center text-amber-400 font-bold">4</td>
                        <td className="p-3 text-center text-emerald-400 font-semibold text-sm">20</td>
                        <td className="p-3 text-right"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Stock Óptimo</span></td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-indigo-300 font-bold">DS-7608NI-K2/8P</td>
                        <td className="p-3 font-bold text-white text-[11px]">NVR Grabador 8 Ch PoE 4K</td>
                        <td className="p-3 text-center font-bold">6</td>
                        <td className="p-3 text-center text-amber-400 font-bold">1</td>
                        <td className="p-3 text-center text-emerald-400 font-semibold text-sm">5</td>
                        <td className="p-3 text-right"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Stock Óptimo</span></td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-indigo-300 font-bold">WD20PURZ</td>
                        <td className="p-3 font-bold text-white text-[11px]">Disco Western Digital Purple 2TB</td>
                        <td className="p-3 text-center font-bold">8</td>
                        <td className="p-3 text-center text-amber-400 font-bold">1</td>
                        <td className="p-3 text-center text-emerald-400 font-semibold text-sm">7</td>
                        <td className="p-3 text-right"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Stock Óptimo</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <span className="text-[11px]">⚡ Al confirmar una venta en el pipeline, las unidades se reservan automáticamente.</span>
                  <span className="text-indigo-400 font-bold cursor-pointer hover:underline">Ver Historial de Movimientos</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 12: WHATSAPP OFICIAL CON IA (Pattern B: Mockup a la izquierda, Texto a la derecha) ── */}
      <section id="whatsapp" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Rich UI Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5 bg-slate-950 rounded-2xl p-3.5 border border-slate-800 space-y-2.5">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Bandeja Oficial Meta</h4>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">API Cloud</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-600/10 border border-indigo-500/30">
                      <div className="flex justify-between items-start mb-1 text-xs">
                        <strong className="text-white text-[11px]">Distribuidora San Martín</strong>
                        <span className="text-slate-400 text-[10px]">18:42</span>
                      </div>
                      <p className="text-[10px] text-slate-300">"Necesitamos 8 cámaras para galpón..."</p>
                      <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500 text-white">
                        Lead #142 Creado
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex justify-between items-start mb-1 text-xs">
                        <strong className="text-slate-300 text-[11px]">Consorcio Las Torres</strong>
                        <span className="text-slate-500 text-[10px]">17:15</span>
                      </div>
                      <p className="text-[10px] text-slate-400">"¿Cómo descargo la Factura A?"</p>
                      <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        Auto-Resuelto Portal
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-7 bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between h-[340px]">
                    <div>
                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-800 mb-3">
                        <span className="text-xs font-bold text-white">Bot WhatsApp IA (Gemini 2.5)</span>
                        <button className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-[10px] hover:bg-emerald-400 shadow">
                          Tomar Conversación
                        </button>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="bg-slate-900 p-2.5 rounded-xl rounded-tl-none border border-slate-800 max-w-[85%] text-slate-200 text-[11px]">
                          "Hola, necesitamos poner 8 cámaras en un galpón de logística para control de camiones."
                        </div>
                        <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl rounded-tr-none ml-auto max-w-[90%] text-emerald-200 text-[11px]">
                          "¡Buenas tardes! Para galpones te recomendamos cámaras <strong>IP Varifocales Hikvision de 4MP</strong> para lectura de patentes más domos fijos internos. Ya derivo tu requerimiento a nuestro especialista comercial junto al proyecto."
                          <span className="text-[9px] text-emerald-400/60 block text-right mt-1">Bot IA · 18:42:02 ✓✓</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300">
                      ⚡ Oportunidad comercial creada automáticamente en el Pipeline Kanban con el chat completo.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  Módulo 12 · WhatsApp Oficial con IA
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Respuesta técnica en 2 segundos: <span className="text-emerald-400">el prospecto nunca más espera</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Bot Inteligente de WhatsApp con IA</strong> de JustCRM, impulsado por el modelo <strong>Google Gemini 2.5 Flash</strong> y conectado a la <strong>API Oficial de WhatsApp de Meta</strong>, atiende las 24 horas del día, los 365 días del año, comprendiendo las necesidades técnicas específicas de seguridad electrónica: <strong>diferencia cámaras térmicas de varifocales, analiza distancias infrarrojas y conoce zonas de centrales de alarma</strong>.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Califica al prospecto al instante, detecta el presupuesto estimado y <strong>crea automáticamente la oportunidad en el Pipeline Comercial</strong> con todo el transcript de la charla adjunto. Si el cliente solicita hablar con un operador, el equipo comercial puede tomar el control del chat con 1 clic ("Takeover"), pausando la IA sin fricción.
              </p>

              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-emerald-400 block mb-1">El dolor que elimina de raíz:</strong>
                Prospectos calificados que escriben un sábado a las 20:00 hs solicitando cámaras para un galpón y, para cuando el vendedor les responde el lunes a media mañana, <strong>ya le compraron e instalaron con la competencia</strong>. El Bot con IA responde en caliente en menos de 2 segundos.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold text-xs">Respuesta en 2s</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Atención inmediata 24/7 sin colas de espera ni formularios aburridos.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Bot className="w-4 h-4" />
                    <span className="font-bold text-xs">Asesor Técnico IA</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Comprende términos de CCTV, alarmas, control de accesos e incendios.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-bold text-xs">Lead en Pipeline</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Crea el contacto y la tarjeta de venta en el embudo con notas precisas.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-purple-400 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="font-bold text-xs">Takeover Humano</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El vendedor toma el control del chat en vivo cuando lo desea con 1 clic.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 13: VISITAS TÉCNICAS, ASISTENCIA Y RRHH (Pattern A: Texto a la izquierda, Mockup a la derecha) ── */}
      <section id="campo" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 mb-2">
                  <CalendarDays className="w-4 h-4 text-cyan-400" />
                  Módulo 13 · Operación de Campo & Fichaje GPS
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Control de cuadrillas y geolocalización: <span className="text-cyan-400">saber dónde está cada técnico</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Módulo de Operación de Campo de JustCRM</strong> sincroniza la agenda de la oficina central con las cuadrillas que están en la calle. Incluye el calendario interactivo de visitas, relevamientos de obra y <strong>fichaje de asistencia biométrico/GPS</strong> directamente desde el navegador del celular.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Al llegar al cliente (country, fábrica o edificio), el técnico ficha su ingreso con <strong>verificación de coordenadas geográficas</strong>. La oficina central ve en tiempo real qué técnico está en viaje, quién está en plena instalación y quién finalizó su jornada, con registro inalterable para liquidación de horas o viáticos.
              </p>

              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-cyan-400 block mb-1">El dolor que elimina de raíz:</strong>
                El clásico "estoy llegando" que dura dos horas, discusiones sobre a qué hora empezó una obra técnica y <strong>falta de constancia fehaciente ante reclamos del cliente</strong> sobre si el instalador realmente estuvo presente o no.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="font-bold text-xs">Fichaje con GPS</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Registro de entrada y salida con latitud y longitud verificadas al instante.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <CalendarDays className="w-4 h-4" />
                    <span className="font-bold text-xs">Agenda de Obras</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Calendario visual con asignación de cuadrillas y turnos de service.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Smartphone className="w-4 h-4" />
                    <span className="font-bold text-xs">100% Web Móvil</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Sin instalar aplicaciones pesadas: funciona en cualquier navegador móvil.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-bold text-xs">Horas en Obra</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Cálculo automático del tiempo exacto dedicado a cada instalación.</p>
                </div>
              </div>
            </div>

            {/* Right: Rich UI Mockup */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white">Eventos & Visitas de Hoy</h4>
                        <p className="text-[10px] text-slate-400">Relevamientos y cuadrillas activas</p>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-white text-[11px]">
                        <span>Relevamiento Fábrica Sur</span>
                        <span className="text-indigo-400 font-mono">10:00 hs</span>
                      </div>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-400" /> Parque Industrial Sur, Nave 4
                      </p>
                      <span className="inline-block mt-1 text-[9px] font-bold text-indigo-300">Asig: Sebastián P.</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white">Fichaje de Asistencia GPS</h4>
                        <p className="text-[10px] text-slate-400">Control geolocalizado en obra</p>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                      <div>
                        <p className="font-bold text-white text-[11px]">Entrada: 08:31 hs</p>
                        <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                          ✓ GPS Validado: S 34.581° W 58.420°
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">Fichar Salida</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <span className="text-[11px]">📍 Mapa de Cuadrillas en Vivo: 4 técnicos activos en CABA y Zona Norte.</span>
                  <span className="text-cyan-400 font-bold underline cursor-pointer">Ver Monitor GPS</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 14: GESTOR DOCUMENTAL CENTRALIZADO (Pattern B: Mockup a la izquierda, Texto a la derecha) ── */}
      <section id="documentos" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Rich UI Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Repositorio Seguro de Archivos</h4>
                  <span className="text-[10px] px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                    Cifrado AES-256
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-4">
                  <div className="p-3.5 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-[11px]">CONTRATOS ABONO</h5>
                      <p className="text-[10px] text-slate-400">182 PDFs firmados</p>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-[11px]">PRESUPUESTOS</h5>
                      <p className="text-[10px] text-slate-400">Historial inmutable</p>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white text-slate-900 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-[11px]">FACTURAS MAYORISTAS</h5>
                      <p className="text-[10px] text-slate-400">OCR & Comprobantes</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-slate-900 text-slate-300">
                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-indigo-400" /> Contrato_Monitoreo_LasTorres_Firmado.pdf</span>
                    <span className="text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1"><Download className="w-3 h-3" /> Descargar</span>
                  </div>
                  <div className="flex justify-between items-center py-1 text-slate-300">
                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-emerald-400" /> Factura_A_Hikvision_Mayorista_00041284.pdf</span>
                    <span className="text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1"><Download className="w-3 h-3" /> Descargar</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5 mb-2">
                  <Folder className="w-4 h-4 text-purple-400" />
                  Módulo 14 · Gestor Documental Centralizado
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Toda la documentación técnica y legal: <span className="text-purple-400">al alcance en 1 clic</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Gestor Documental de JustCRM</strong> centraliza en una nube segura y cifrada todos los archivos que mueven tu negocio: <strong>contratos firmados de abonos de monitoreo</strong>, <strong>manuales de configuración de centrales y cámaras</strong>, <strong>planos de canalización</strong>, <strong>presupuestos emitidos</strong> y <strong>facturas de compra de distribuidores</strong>.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Cada cliente, cada oportunidad comercial y cada orden técnica posee su propio <strong>expediente digital inmutable</strong>. Cualquier miembro autorizado de tu equipo puede consultar el plano de tendido de fibra o el certificado de garantía del grabador NVR sin tener que buscar en viejos discos duros ni en mensajes de chat personales.
              </p>

              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-purple-400 block mb-1">El dolor que elimina de raíz:</strong>
                Documentos críticos desparramados en computadoras individuales de empleados que renuncian, <strong>contratos de abonos extraviados que impiden ejecutar cobranzas judiciales</strong> y manuales perdidos justo cuando el técnico está en el techo tratando de configurar un sensor.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-purple-400 mb-1">
                    <Folder className="w-4 h-4" />
                    <span className="font-bold text-xs">Expediente Único</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Contratos, remitos y pólizas agrupados por ficha de cliente y obra.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Lock className="w-4 h-4" />
                    <span className="font-bold text-xs">Nube Cifrada</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Almacenamiento seguro con permisos restringidos y respaldo automático.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Download className="w-4 h-4" />
                    <span className="font-bold text-xs">Descarga Rápida</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Accedé a facturas históricas y certificados de garantía en segundos.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="font-bold text-xs">Adjuntos en Tareas</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El técnico ve los planos y manuales directamente desde su teléfono.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 15: MATRIZ DE ROLES & PERMISOS (Pattern A: Texto a la izquierda, Mockup a la derecha) ── */}
      <section id="roles" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 mb-2">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  Módulo 15 · Blindaje & Permisos Granulares
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Privacidad absoluta y control total: <span className="text-indigo-400">cada quien ve lo suyo</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                La <strong>Matriz de Permisos de JustCRM</strong> garantiza que cada persona de tu organización acceda exclusivamente a la información requerida para su función: <strong>Super Admin, Gerente de Ventas, Asesor Comercial (`SELLER`), Técnico de Campo (`TECHNICIAN`) y Administración</strong>.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Los vendedores <strong>únicamente visualizan sus propios clientes y cotizaciones</strong>, impidiendo la filtración de la cartera completa. Los técnicos solo ven sus órdenes de trabajo asignadas sin acceso a los datos financieros ni a los márgenes de ganancia de los productos, protegiendo el secreto comercial más valioso de tu empresa.
              </p>

              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-indigo-400 block mb-1">El dolor que elimina de raíz:</strong>
                El temor permanente a que un vendedor o técnico desleal <strong>se descargue tu base de datos de 2.000 clientes</strong> y se vaya a trabajar a la competencia o se independice usando tus propios precios de costo y márgenes comerciales.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Lock className="w-4 h-4" />
                    <span className="font-bold text-xs">Cartera Protegida</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Los comerciales solo ven sus propios prospectos y presupuestos emitidos.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-bold text-xs">Márgenes Ocultos</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El personal técnico no tiene acceso a los costos de compra ni rentabilidad.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="font-bold text-xs">Cobranzas Blindadas</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Solo administración y directores pueden autorizar modificaciones de tarifas o cobranzas.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-purple-400 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="font-bold text-xs">5 Perfiles Nativos</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Roles predefinidos y listos para usar sin configuraciones complejas.</p>
                </div>
              </div>
            </div>

            {/* Right: Rich UI Mockup */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3 text-left">Módulo / Permiso</th>
                      <th className="p-3 text-center">Super Admin</th>
                      <th className="p-3 text-center">Ventas</th>
                      <th className="p-3 text-center">Técnica</th>
                      <th className="p-3 text-center">Administración</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    <tr>
                      <td className="p-3 font-bold text-white">Dashboard Financiero & MRR</td>
                      <td className="p-3 text-center text-emerald-400">✓ Total</td>
                      <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                      <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                      <td className="p-3 text-center text-emerald-400">✓ Total</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-white">Cotizador Flash & Márgenes</td>
                      <td className="p-3 text-center text-emerald-400">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400">✓ Total</td>
                      <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                      <td className="p-3 text-center text-emerald-400">✓ Total</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-white">Pipeline de Oportunidades</td>
                      <td className="p-3 text-center text-emerald-400">✓ Global</td>
                      <td className="p-3 text-center text-indigo-400 font-bold">Solo Propias</td>
                      <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                      <td className="p-3 text-center text-slate-400">Solo Lectura</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-white">Depósito & Salida de Pañol</td>
                      <td className="p-3 text-center text-emerald-400">✓ Total</td>
                      <td className="p-3 text-center text-slate-400">Solo Libre</td>
                      <td className="p-3 text-center text-emerald-400">✓ Remitos</td>
                      <td className="p-3 text-center text-emerald-400">✓ Compras</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-white">Gestión de Abonos & Cobranzas</td>
                      <td className="p-3 text-center text-emerald-400">✓ Total</td>
                      <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                      <td className="p-3 text-center text-slate-600">✕ Bloqueado</td>
                      <td className="p-3 text-center text-emerald-400">✓ Gestión Total</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 16: PORTAL B2B MAYORISTA PARA GREMIO E INSTALADORES (Pattern B: Mockup a la izquierda, Texto a la derecha) ── */}
      <section id="portal-gremio" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Rich UI Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
                      Gremio Nivel 1 (30% OFF)
                    </span>
                    <span className="text-xs text-slate-400">Instalaciones Técnicas Martínez</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">Carrito: US$ 605,00</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">Stock: 20</span>
                        <span className="font-mono text-slate-400 text-[9px]">DS-2CD2123G2-I</span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-900 line-clamp-2">Domo IP Hikvision AcuSense 2MP</h5>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 line-through block">Púb: US$ 120,00</span>
                      <strong className="text-xs font-semibold text-emerald-700 font-mono">Gremio: US$ 85,00</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">Stock: 5</span>
                        <span className="font-mono text-slate-400 text-[9px]">DS-7608NI-K2/8P</span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-900 line-clamp-2">Grabador NVR 8CH PoE 4K</h5>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 line-through block">Púb: US$ 270,00</span>
                      <strong className="text-xs font-semibold text-emerald-700 font-mono">Gremio: US$ 195,00</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[9px]">Stock: 14</span>
                        <span className="font-mono text-slate-400 text-[9px]">UTP-CAT5E-EXT</span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-900 line-clamp-2">Bobina UTP 305m Exterior 100% Cobre</h5>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 line-through block">Púb: US$ 130,00</span>
                      <strong className="text-xs font-semibold text-emerald-700 font-mono">Gremio: US$ 88,00</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                  <span className="text-slate-400 text-[11px]">Reserva de mercadería directa en pañol sin llamado previo.</span>
                  <button className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow">
                    Confirmar Pedido de Obra
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Deep Explanatory Text & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
                  <Briefcase className="w-4 h-4 text-amber-400" />
                  Módulo 16 · Portal B2B Mayorista para Gremio
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Canal e-commerce para instaladores: <span className="text-amber-400">pedidos en 30 segundos</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Portal B2B de JustCRM</strong> convierte a tu empresa en un distribuidor mayorista digital de seguridad electrónica para gremio, instaladores y técnicos independientes. Cada cliente B2B accede con sus <strong>condiciones comerciales y descuentos asignados (20%, 30% o 40% off)</strong>.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Pueden consultar la disponibilidad de stock en tiempo real en tu depósito central, armar carritos de obra con cámaras, cables, baluns y NVRs, y <strong>generar la orden de reserva en pañol al instante</strong> sin necesidad de esperar a que un vendedor los atienda por teléfono.
              </p>

              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-amber-400 block mb-1">El dolor que elimina de raíz:</strong>
                Decenas de instaladores llamando por WhatsApp a tus vendedores para consultar precios repetitivos como: <strong>"¿a cuánto me dejás el rollo de UTP?"</strong> o "¿te queda el NVR de 8 canales?". En su portal ven sus precios y stock exactos en tiempo real.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-bold text-xs">Precios Gremio</span>
                  </div>
                  <p className="text-[11px] text-slate-400">El instalador ve automáticamente sus tarifas con descuento mayorista.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Package className="w-4 h-4" />
                    <span className="font-bold text-xs">Stock en Vivo</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Consulta de unidades disponibles en pañol sin consultar a la oficina.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="font-bold text-xs">Reserva Flash</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Cierre del pedido con bloqueo de materiales en depósito en 30 segundos.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Briefcase className="w-4 h-4" />
                    <span className="font-bold text-xs">Listas en PDF</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Descarga de listas duales en PDF y Excel para cotizar a sus clientes.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 17: PANEL OPERATIVO MÓVIL 'MI DÍA' (Pattern A: Texto a la izquierda, Mockup a la derecha) ── */}
      <section id="mi-dia" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Rich UI Mockup (Smartphone Frame) */}
            <div className="lg:col-span-7 order-2 lg:order-2 flex justify-center">
              <div className="w-full max-w-sm bg-slate-900 border-4 border-slate-800 rounded-[2.5rem] p-4 shadow-2xl overflow-hidden">
                {/* Smartphone Notch & Status */}
                <div className="flex justify-between items-center px-4 py-1 text-[10px] text-slate-400 font-mono mb-3">
                  <span>09:41</span>
                  <span className="w-20 h-4 bg-slate-800 rounded-full inline-block"></span>
                  <span>4G 100%</span>
                </div>

                {/* Header App Técnico */}
                <div className="p-4 rounded-2xl bg-indigo-600 text-white mb-3 shadow">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Mi Día · Miércoles 23 de Septiembre</span>
                  <h3 className="text-base font-semibold">Lucas Martínez</h3>
                  <p className="text-xs text-indigo-100 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-emerald-300" /> Jornada Iniciada: 08:31 hs (GPS OK)
                  </p>
                </div>

                {/* Visita de Hoy */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-3 mb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                        09:30 hs · Obra Urgente
                      </span>
                      <h4 className="font-bold text-white text-sm mt-1">Consorcio Las Torres</h4>
                      <p className="text-slate-400 text-[11px]">Av. del Libertador 4450 · CABA</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900">
                    <button className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-cyan-400" /> Waze / Maps
                    </button>
                    <button className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5" /> Encargado
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-900 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Checklist Técnico de Instalación:</span>
                    <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Montaje de 4 domos AcuSense en cocheras</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Conexión a grabador NVR PoE y disco 2TB</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <span className="w-3.5 h-3.5 rounded border border-slate-600 shrink-0 inline-block"></span>
                      <span>Vinculación de App con administradores</span>
                    </div>
                  </div>

                  <button className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow">
                    <Camera className="w-3.5 h-3.5" /> Adjuntar Fotos & Firma de Recepción
                  </button>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-[10px] text-slate-400 flex justify-between items-center">
                  <span>Próxima: Fábrica Metalúrgica (14:30)</span>
                  <span className="text-indigo-400 font-bold">Ver Hoja</span>
                </div>
              </div>
            </div>

            {/* Right: Deep Copy & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Módulo 17 · Panel Operativo Móvil 'Mi Día'
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  La hoja de ruta del técnico en su celular: <span className="text-emerald-400">cero llamadas, máxima autonomía</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El <strong>Panel Móvil 'Mi Día' de JustCRM</strong> convierte el smartphone de cada instalador en su centro operativo de campo. Al comenzar la jornada, el operario hace <strong>fichaje con geolocalización GPS</strong> y visualiza su itinerario de visitas del día ordenado por horario y prioridad sin necesidad de pasar a buscar papeles a la oficina.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Cada orden incluye los <strong>datos del contacto en obra</strong>, navegación directa en <strong>Waze o Google Maps en 1 toque</strong>, el checklist estandarizado de materiales e instalación, y la posibilidad de <strong>sacar fotos del rack terminado</strong> y solicitar la firma digital del encargado directamente sobre la pantalla táctil.
              </p>

              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-emerald-400 block mb-1">El dolor que elimina de raíz:</strong>
                Instaladores llamando a la oficina para pedir teléfonos o direcciones, técnicos perdidos en el tránsito, materiales no reportados y <strong>clientes que aseguran que el técnico nunca se presentó a la obra</strong>.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Smartphone className="w-4 h-4" />
                    <span className="font-bold text-xs">100% Web Móvil</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Funciona en cualquier navegador de Android o iOS sin instalar APKs pesadas.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Navigation className="w-4 h-4" />
                    <span className="font-bold text-xs">Ruta en 1 Toque</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Abre Waze o Google Maps con las coordenadas exactas de la obra.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <CheckSquare className="w-4 h-4" />
                    <span className="font-bold text-xs">Checklist Técnico</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Procedimientos estandarizados que garantizan instalaciones impecables.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Camera className="w-4 h-4" />
                    <span className="font-bold text-xs">Fotos & Firma</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Registro fotográfico de prolijidad en rack y firma digital de conformidad.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MÓDULO 18: SETUP ÁGIL & MIGRACIÓN EN 15 MINUTOS (Pattern B: Mockup a la izquierda, Texto a la derecha) ── */}
      <section id="onboarding" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left: Deep Copy & Benefit Squares */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Módulo 18 · Setup Ágil & Migración Sin Fricción
                </span>
                <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
                  Tu CRM listo y cotizando en 15 minutos: <span className="text-emerald-400">sin consultorías de meses</span>.
                </h2>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                El mayor miedo al contratar software empresarial es la implementación: <strong>meses de consultores externos cobrando fortunas, parálisis operativa y equipos que no aprenden a usar el sistema</strong>. JustCRM fue creado bajo la filosofía de fricción cero, con un <strong>Asistente de Activación guiado en 4 pasos</strong> adaptado al negocio técnico.
              </p>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Cargás tu logo y datos comerciales, configurás tu <strong>catálogo propio de artículos y servicios</strong> con listas duales de Gremio y Público en USD o ARS, vinculás tu línea de WhatsApp de Meta y das de alta a tus colaboradores con roles preconfigurados. Tu empresa queda <strong>100% lista para cotizar y operar en el mismo día</strong>.
              </p>

              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-slate-300 leading-relaxed">
                <strong className="text-emerald-400 block mb-1">El dolor que elimina de raíz:</strong>
                El pánico a cambiar de sistema, perder semanas cargando tablas de Excel a mano, pagar consultorías eternas y <strong>sufrir la resistencia de empleados que rechazan plataformas complicadas</strong>.
              </div>

              {/* Cuadraditos con los Beneficios Directos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="font-bold text-xs">Setup en 15 Minutos</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Puesta en marcha express guiada paso a paso sin requerir técnicos externos.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Package className="w-4 h-4" />
                    <span className="font-bold text-xs">Catálogo Propio Dual</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Cargá tus cámaras, alarmas y abonos con listas duales de gremio y público.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <Bot className="w-4 h-4" />
                    <span className="font-bold text-xs">WhatsApp en 3 Clics</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Conexión oficial guiada con Meta para atender y calificar prospectos 24/7.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-purple-400 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="font-bold text-xs">Capacitación Incluida</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Interfaz intuitiva y soporte humano para una adopción inmediata en todo el equipo.</p>
                </div>
              </div>
            </div>

            {/* Right: Rich UI Mockup */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-2xl space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Progreso de Activación Inicial</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">100% · Listo para Operar</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-semibold flex items-center justify-center text-[10px]">✓</span>
                      <span className="text-[10px] text-emerald-400 font-bold">2 minutos</span>
                    </div>
                    <h4 className="font-bold text-white text-xs">1. Razón Social & Logo</h4>
                    <p className="text-slate-400 text-[11px] mt-1">Empresa, logo y datos comerciales configurados para tus cotizaciones White-Clean.</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-semibold flex items-center justify-center text-[10px]">✓</span>
                      <span className="text-[10px] text-emerald-400 font-bold">Inmediato</span>
                    </div>
                    <h4 className="font-bold text-white text-xs">2. Catálogo Propio Dual</h4>
                    <p className="text-slate-400 text-[11px] mt-1">Carga ágil de productos y servicios con listas de gremio y público en USD/ARS.</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-semibold flex items-center justify-center text-[10px]">✓</span>
                      <span className="text-[10px] text-emerald-400 font-bold">3 minutos</span>
                    </div>
                    <h4 className="font-bold text-white text-xs">3. WhatsApp Oficial con IA</h4>
                    <p className="text-slate-400 text-[11px] mt-1">Línea de Meta vinculada y Bot con IA Gemini 2.5 activado 24/7.</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-semibold flex items-center justify-center text-[10px]">✓</span>
                      <span className="text-[10px] text-emerald-400 font-bold">5 minutos</span>
                    </div>
                    <h4 className="font-bold text-white text-xs">4. Invitaciones al Equipo</h4>
                    <p className="text-slate-400 text-[11px] mt-1">Vendedores, técnicos y administración con roles y permisos asignados.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs text-emerald-400 font-bold">
                    🚀 ¡Tu empresa está lista para operar! Empezá a cotizar y atender en tiempo récord.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── PLANES DE SUSCRIPCIÓN ─────────────────────────────────────── */}
      <section id="planes" className="py-24 bg-[#070b14] border-t border-slate-800 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Inversión Transparente</span>
            <h2 className="text-3xl sm:text-5xl font-semibold text-white mt-2">
              Planes claros y adaptados a tu escala
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Menos de lo que perdés con una sola venta caída por demorarte en contestar.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto text-left">
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <h3 className="text-xl font-bold text-white">Starter Instalador</h3>
                <p className="text-xs text-slate-400 mt-1">Para técnicos independientes y equipos chicos de hasta 3 personas.</p>
                <div className="mt-6 mb-6">
                  <span className="text-3xl font-semibold text-white">Consultar</span>
                  <span className="text-xs text-slate-400 block mt-1">Planes a medida en pesos o dólares</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Hasta 3 usuarios incluidos</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Cotizador Flash ilimitado con PDF White-Clean</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Catálogo Propio con Listas Duales (Gremio & Público)</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Pipeline de ventas Kanban</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Conteo inicial de stock sin factura</li>
                </ul>
              </div>
              <a
                href="#contacto"
                className="mt-8 w-full py-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs text-center transition-all block"
              >
                Solicitar Cotización Starter
              </a>
            </div>

            <div className="rounded-3xl bg-[#00496b]/20 border border-cyan-400/40 p-8 flex flex-col justify-between shadow-2xl relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#00628e] text-white font-medium text-[11px] uppercase tracking-wider shadow border border-cyan-400/40">
                MÁS ELEGIDO POR EMPRESAS
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Security Pro & Bot IA</h3>
                <p className="text-xs text-slate-300 mt-1">Para empresas de seguridad, monitoreo y CCTV que quieren escalar.</p>
                <div className="mt-6 mb-6">
                  <span className="text-3xl font-semibold text-white">Plan Pro</span>
                  <span className="text-xs text-cyan-300 block mt-1">Con Bot de WhatsApp con IA (Gemini 2.5)</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-200">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> <strong>Usuarios ilimitados</strong> para todo el equipo</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> <strong>Bot de WhatsApp con IA (Meta Oficial)</strong></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Derivación automática con transcript a Ventas/Soporte</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Inbox compartido de WhatsApp con Takeover humano</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Gestión de Servicios Recurrentes (MRR / ARR)</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> App Móvil 'Mi Día' para técnicos en calle</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Remitos y órdenes de entrega con código de componentes</li>
                </ul>
              </div>
              <a
                href="#contacto"
                className="mt-8 w-full py-3.5 rounded-full bg-[#00628e] hover:bg-[#00496b] text-white font-medium text-xs text-center shadow-md transition-all border border-cyan-400/30 block"
              >
                Comenzar con Plan Pro
              </a>
            </div>

            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <h3 className="text-xl font-semibold text-white">Enterprise White-Label</h3>
                <p className="text-xs text-slate-400 mt-1">Para grandes integradores, franquicias o múltiples depósitos.</p>
                <div className="mt-6 mb-6">
                  <span className="text-3xl font-semibold text-white">A Medida</span>
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
                className="mt-8 w-full py-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs text-center transition-all block"
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
            <h2 className="text-3xl font-semibold text-white mt-2">
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
      <section id="contacto" className="py-24 bg-gradient-to-b from-[#070b14] to-slate-950 border-t border-slate-800 text-center px-4 relative overflow-hidden">
        {/* Glow ambiental suave detrás */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00628e]/15 blur-[130px] pointer-events-none rounded-full" />

        <div className="max-w-xl mx-auto relative z-10">
          
          {/* Contenedor Claro Elegante (Tarjetón Blanco Arquitectónico) */}
          <div className="bg-white rounded-[32px] p-8 sm:p-12 border border-[#d6dde5] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] text-left relative">
            
            {/* Logo de JustCRM original sin fondo, sobre el contenedor blanco */}
            <div className="flex justify-center mb-6">
              <img src="/Logo-sin-fondo.png" alt="JustCRM Logo" className="h-12 sm:h-14 w-auto object-contain" />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 mb-2.5">
                Terminá con el Caos Operativo Hoy
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm font-normal max-w-md mx-auto leading-relaxed">
                Completá tus datos y un especialista técnico de JustCreate te contactará hoy mismo para coordinar una demo guiada de 15 minutos.
              </p>
            </div>

            {isSubmitted ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm animate-landing-fade-in">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-semibold text-slate-900">¡Solicitud Recibida con Éxito!</h3>
                  <p className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed">
                    Muchas gracias <strong>{contactName}</strong>. La información fue enviada a nuestro equipo en <span className="text-[#00628e] font-medium">contacto@justcreate.com.ar</span>. Te contactaremos hoy mismo a tu WhatsApp (<strong className="text-slate-900">{contactPhone}</strong>).
                  </p>
                </div>

                <div className="pt-3 border-t border-emerald-200/60 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href={`https://wa.me/5491124527669?text=${encodeURIComponent(`Hola JustCRM, acabo de solicitar una demo para ${contactCompany || contactName}. Mi email es ${contactEmail}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white font-medium text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Hablar por WhatsApp Ahora Directo</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitted(false)
                      setContactName('')
                      setContactCompany('')
                      setContactEmail('')
                      setContactPhone('')
                      setContactMessage('')
                    }}
                    className="w-full sm:w-auto px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Enviar otra consulta
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setIsSubmitting(true)
                  setSubmitError(null)

                  try {
                    const res = await fetch('/api/contacto', {
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

                    const data = await res.json()
                    if (!res.ok) {
                      throw new Error(data.error || 'Ocurrió un error al enviar el formulario.')
                    }

                    setIsSubmitted(true)
                  } catch (err: any) {
                    console.error('Error submitting contact form:', err)
                    setSubmitError(err.message || 'No se pudo enviar. Podés contactarnos directo por WhatsApp.')
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
                className="space-y-4"
              >
                {submitError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                    {submitError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nombre y Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-4 py-3 rounded-xl bg-[#f8fafc] border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 transition-all font-normal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Empresa o Razón Social
                  </label>
                  <input
                    type="text"
                    value={contactCompany}
                    onChange={(e) => setContactCompany(e.target.value)}
                    placeholder="Ej. Seguridad & Alarmas SRL"
                    className="w-full px-4 py-3 rounded-xl bg-[#f8fafc] border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 transition-all font-normal"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Corporativo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="juan@empresa.com"
                      className="w-full px-4 py-3 rounded-xl bg-[#f8fafc] border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 transition-all font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      WhatsApp / Teléfono <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+54 9 11 ..."
                      className="w-full px-4 py-3 rounded-xl bg-[#f8fafc] border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 transition-all font-normal"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ¿Qué proceso u operación te gustaría optimizar? (Opcional)
                  </label>
                  <input
                    type="text"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Ej. Cotizaciones más rápidas, WhatsApp con IA, remitos de obra..."
                    className="w-full px-4 py-3 rounded-xl bg-[#f8fafc] border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-[#00628e] focus:bg-white focus:ring-2 focus:ring-[#00628e]/15 transition-all font-normal"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3.5 rounded-full bg-[#00628e] hover:bg-[#00496b] text-white font-medium text-sm shadow-md shadow-[#00628e]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-cyan-400/30"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enviando solicitud a contacto@justcreate.com.ar...</span>
                    </>
                  ) : (
                    <>
                      <span>Agendar Demostración Personalizada</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="py-10 bg-slate-950 border-t border-slate-900 text-slate-500 text-xs text-center sm:text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo-fondo-redondeado.png" alt="JustCRM Logo" className="h-8 w-auto object-contain" />
            <p className="text-slate-400">JustCRM · Desarrollado con orgullo por <a href="https://justcreate.com.ar" target="_blank" rel="noreferrer" className="text-slate-300 hover:text-white underline">JustCreate</a></p>
          </div>
          <p>© 2026 JustCRM. Todos los derechos reservados.</p>
        </div>
      </footer>

      {/* ── Botón Flotante de WhatsApp para Contacto Directo ───────── */}
      <aside aria-label="Contacto WhatsApp" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 group">
        <span className="hidden sm:inline-block px-3.5 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700 text-xs font-semibold text-slate-200 shadow-2xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          ¿Dudas? Chateá con nosotros 👋
        </span>
        <a
          href="https://wa.me/5491124527669?text=Hola%20JustCRM,%20quiero%20solicitar%20una%20demostraci%C3%B3n%20y%20conocer%20m%C3%A1s%20detalles."
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contactar por WhatsApp directo"
          className="relative w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-400/30"
        >
          <span className="absolute -inset-1 rounded-full bg-[#25D366]/40 animate-ping pointer-events-none -z-10" />
          <svg
            className="w-7 h-7 fill-current"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      </aside>
    </div>
  )
}
