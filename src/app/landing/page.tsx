'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Shield, Zap, Bot, FileText, BarChart3, Layers, Package, Users,
  CheckCircle2, ArrowRight, Play, Clock, Sparkles, Send, Check,
  ChevronDown, PhoneCall, AlertTriangle, Eye, RefreshCw, X,
  TrendingUp, DollarSign, Calendar, MessageSquare, Flame, CheckCheck,
  Receipt, ArrowUpRight, Laptop, Smartphone, Lock
} from 'lucide-react'

export default function LandingPage() {
  const [activeScreen, setActiveScreen] = useState<'cotizador' | 'whatsapp' | 'pipeline' | 'stock' | 'facturacion' | 'dashboard'>('cotizador')
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD')
  const [priceMode, setPriceMode] = useState<'GREMIO' | 'PUBLICO'>('GREMIO')
  const [liveNotification, setLiveNotification] = useState(0)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  // Rotating live notifications to show real-time automation
  const notifications = [
    { text: '🤖 NISSI derivó un lead de 8 cámaras IP al Pipeline de Ventas', time: 'hace 2 min', tag: 'WhatsApp IA' },
    { text: '⚡ Cotización #PRESUP-842 enviada en 24 segundos por email', time: 'hace 5 min', tag: 'Cotizador' },
    { text: '📦 4 Domos Hikvision AcuSense reservados para instalación', time: 'hace 8 min', tag: 'Depósito' },
    { text: '🧾 Factura A #0004-00012984 emitida con CAE de ARCA/AFIP', time: 'hace 14 min', tag: 'Finanzas' }
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveNotification((prev) => (prev + 1) % notifications.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [notifications.length])

  const faqs = [
    {
      q: '¿Por qué JustCRM es superior para empresas de seguridad frente a un CRM tradicional?',
      a: 'Porque los CRMs tradicionales no entienden el rubro: no saben cotizar kits de cámaras con componentes desglosados para el pañol, no manejan listas duales de Gremio vs Público, no permiten cargar stock físico sin factura de compra y no emiten facturas electrónicas con CAE de AFIP. Con JustCRM tenés todo nativo en una sola pantalla.'
    },
    {
      q: '¿Cómo funciona el Bot de WhatsApp NISSI y cómo interactúa con el catálogo?',
      a: 'NISSI corre sobre Gemini 2.5 Flash conectado a la API oficial de Meta. Entiende lenguaje natural técnico (cámaras IP vs analógicas, analítica AcuSense, distancias infrarrojas, centrales de alarma). Jamás inventa un precio: cuando detecta intención de compra o soporte, deriva al instante con la transcripción completa pegada en la ficha del cliente.'
    },
    {
      q: '¿Qué pasa si un vendedor quiere responder en vivo por WhatsApp?',
      a: 'El CRM cuenta con una bandeja de entrada compartida. Con 1 clic en "Tomar conversación", el humano atiende directamente y NISSI se silencia automáticamente para ese chat. Cuando termina, puede devolver el control al bot con un botón o el sistema lo reactiva a las 24 horas.'
    },
    {
      q: '¿Puedo cargar mi inventario actual si no tengo las facturas de compra a mano?',
      a: 'Sí, absolutamente. Gracias al módulo exclusivo de "Conteo Físico Inicial", podés contar lo que tenés en tus estanterías (cámaras, baluns, cables, fuentes) e ingresarlo al CRM con un clic para tener tu inventario listo y visible para ventas en menos de 2 horas.'
    },
    {
      q: '¿Cómo se resuelven las cotizaciones en dólares y pesos en Argentina?',
      a: 'El cotizador lee el tipo de cambio oficial en vivo. Podés presupuestar en USD (estándar de CCTV y alarmas importadas) y conmutar a Pesos con IVA discriminado (21% o 10.5%). El PDF White-Clean se genera en segundos con validez técnica congelada.'
    },
    {
      q: '¿Los vendedores pueden ver las cotizaciones o clientes de sus compañeros?',
      a: 'No, a menos que tengan rol de Gerente o Administrador. Cada vendedor solo ve sus propios prospectos y tratos, resguardando la privacidad de tu base de clientes.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased overflow-x-hidden">
      
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#070b14]/85 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-500 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                JustCRM <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Security OS</span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium -mt-0.5">by JustCreate</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-300">
            <a href="#pantallas" className="hover:text-white transition-colors">Pantallas del Sistema</a>
            <a href="#dolores" className="hover:text-white transition-colors">Dolores que Eliminamos</a>
            <a href="#planes" className="hover:text-white transition-colors">Planes</a>
            <a href="#faq" className="hover:text-white transition-colors">Preguntas</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              Ingresar
            </Link>
            <a
              href="#contacto"
              className="text-xs sm:text-sm font-black px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 via-indigo-600 to-cyan-500 hover:from-red-600 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span>Ver Demo en Vivo</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero: Título Corto, Impactante y al Grano ─────────────────── */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden text-center">
        {/* Glow ambient effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[450px] bg-gradient-to-tr from-red-600/20 via-indigo-600/20 to-cyan-400/15 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700/80 text-xs font-bold text-indigo-300 mb-8 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>El único CRM vertical para Seguridad Electrónica & IoT</span>
          </div>

          {/* Título de 4 palabras: contundente */}
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[0.98] mb-6">
            Menos caos. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-indigo-300 to-cyan-300">
              Más instalaciones.
            </span>
          </h1>

          {/* Subtítulo claro: ataca tiempo y desorden */}
          <p className="text-lg sm:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
            Cotizaciones flash en 30 segundos, WhatsApp con IA 24/7 y depósito bajo control. <br className="hidden sm:inline" />
            <strong className="text-white font-semibold">Toda tu empresa hablando exactamente el mismo idioma.</strong>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <a
              href="#contacto"
              className="w-full sm:w-auto px-9 py-4 rounded-xl bg-gradient-to-r from-red-500 via-indigo-600 to-cyan-500 hover:from-red-600 hover:to-indigo-600 text-white font-black text-base shadow-xl shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
            >
              <span>Agendar Demostración Personalizada</span>
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#pantallas"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-base border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
              <span>Explorar las Pantallas del Sistema</span>
            </a>
          </div>

          {/* Live Floating Automation Ticker */}
          <div className="max-w-2xl mx-auto p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between gap-4 text-left">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {notifications[liveNotification].tag}
              </span>
              <p className="text-xs text-slate-200 font-medium">
                {notifications[liveNotification].text}
              </p>
            </div>
            <span className="text-[10px] text-slate-500 whitespace-nowrap">
              {notifications[liveNotification].time}
            </span>
          </div>

        </div>
      </section>

      {/* ── THE INTERACTIVE SYSTEM SHOWCASE (PANTALLAS EN VIVO) ────────── */}
      <section id="pantallas" className="py-20 bg-slate-950 border-t border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Recorrido Visual</span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-2">
              Mirá cómo se ve tu empresa funcionando sin fricción
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Hacé clic en cada módulo para ver la pantalla real del sistema y cómo resuelve cada operación:
            </p>
          </div>

          {/* Screen Switcher Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              { id: 'cotizador', label: '1. Cotizador Flash & PDF', icon: FileText },
              { id: 'whatsapp', label: '2. WhatsApp IA (NISSI)', icon: Bot },
              { id: 'pipeline', label: '3. Pipeline de Ventas', icon: Layers },
              { id: 'stock', label: '4. Depósito & Conteo Inicial', icon: Package },
              { id: 'facturacion', label: '5. Facturación ARCA / AFIP', icon: Receipt },
              { id: 'dashboard', label: '6. Dashboard Ejecutivo', icon: BarChart3 },
            ].map(tab => {
              const Icon = tab.icon
              const isActive = activeScreen === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveScreen(tab.id as any)}
                  className={`px-4 sm:px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2.5 border ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-500 shadow-xl shadow-indigo-600/30 scale-105'
                      : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-300' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Browser Chrome Container */}
          <div className="max-w-6xl mx-auto rounded-3xl border border-slate-700/80 bg-slate-900/90 shadow-2xl p-2 sm:p-5 backdrop-blur-xl">
            
            {/* Top Browser Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 px-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-mono text-slate-400 ml-2">
                  justcrm.app / {activeScreen}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Operación en Tiempo Real
                </span>
              </div>
            </div>

            {/* SCREEN 1: COTIZADOR FLASH */}
            {activeScreen === 'cotizador' && (
              <div className="p-4 sm:p-6 text-left">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-400" />
                      Cotizador Flash · Presupuesto #PRESUP-2026-AB
                    </h3>
                    <p className="text-xs text-slate-400">Cliente: Consorcio Torre Alvear · Validez: 15 días</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                      <button
                        onClick={() => setPriceMode('GREMIO')}
                        className={`px-3 py-1 rounded text-xs font-bold ${priceMode === 'GREMIO' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
                      >
                        Precio Gremio
                      </button>
                      <button
                        onClick={() => setPriceMode('PUBLICO')}
                        className={`px-3 py-1 rounded text-xs font-bold ${priceMode === 'PUBLICO' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        Público Final
                      </button>
                    </div>

                    <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                      <button
                        onClick={() => setCurrency('USD')}
                        className={`px-3 py-1 rounded text-xs font-bold ${currency === 'USD' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        USD
                      </button>
                      <button
                        onClick={() => setCurrency('ARS')}
                        className={`px-3 py-1 rounded text-xs font-bold ${currency === 'ARS' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        ARS ($ 1.280)
                      </button>
                    </div>
                  </div>
                </div>

                {/* PDF White-Clean Mock */}
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
                      <p className="text-[11px] text-slate-500 mt-1">Fecha: {new Date().toLocaleDateString('es-AR')}</p>
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
                        <p className="font-bold text-slate-900"><span className="text-indigo-600 font-mono">[DS-2CD2123G2-I]</span> Domo IP Hikvision AcuSense 2MP</p>
                        <p className="text-[11px] text-slate-500 italic">Detección inteligente de humanos/vehículos. Lente 2.8mm, IR 30m, IK10 antivandálica.</p>
                      </div>
                      <div className="col-span-2 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">PRODUCTO</span></div>
                      <div className="col-span-2 text-center text-slate-600 font-medium">4 × unidad</div>
                      <div className="col-span-2 text-right font-bold text-slate-900">{priceMode === 'GREMIO' ? (currency === 'USD' ? 'US$ 340,00' : '$ 435.200') : (currency === 'USD' ? 'US$ 480,00' : '$ 614.400')}</div>
                    </div>

                    <div className="grid grid-cols-12 text-xs py-2 border-b border-slate-100 items-center">
                      <div className="col-span-6 pr-2">
                        <p className="font-bold text-slate-900"><span className="text-indigo-600 font-mono">[DS-7608NI-K2/8P]</span> Grabador NVR 8 Canales PoE 4K</p>
                        <p className="text-[11px] text-slate-500 italic">Switch PoE integrado de 8 bocas independientes. Soporta 2 discos rígidos de hasta 8TB.</p>
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
                  <span>⚡ Presupuesto generado en <strong>22 segundos</strong>. Listo para enviar por email.</span>
                  <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> Enviar PDF por Email con 1 Clic
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 2: WHATSAPP IA (NISSI) */}
            {activeScreen === 'whatsapp' && (
              <div className="p-4 sm:p-6 text-left">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Chat List */}
                  <div className="lg:col-span-4 bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Bandeja Oficial WhatsApp</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">En Línea</span>
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-indigo-600/10 border border-indigo-500/30 cursor-pointer">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-xs text-white">Distribuidora San Martín</span>
                          <span className="text-[10px] text-indigo-300">18:42</span>
                        </div>
                        <p className="text-[11px] text-slate-300 line-clamp-1">"Necesitamos 8 cámaras para galpón..."</p>
                        <span className="inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-500 text-white">
                          Derivado a Ventas
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer opacity-70">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-xs text-white">Barrio Los Robles (Admin)</span>
                          <span className="text-[10px] text-slate-500">17:15</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">"La barrera de acceso no levanta..."</p>
                        <span className="inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          Ticket de Soporte #108
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Active Chat Thread */}
                  <div className="lg:col-span-8 bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between h-[420px]">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                            SM
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white">Distribuidora San Martín · +54 9 11 5821-XXXX</h4>
                            <p className="text-[10px] text-emerald-400">Atendido por: Bot NISSI (Gemini 2.5 Flash)</p>
                          </div>
                        </div>
                        <button className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400 flex items-center gap-1.5 shadow">
                          <Check className="w-3.5 h-3.5" /> Tomar Conversación (Humano)
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="bg-slate-900 p-3 rounded-xl rounded-tl-none border border-slate-800 max-w-[80%]">
                          <p className="text-slate-200">"Hola buenas tardes, necesitamos instalar 8 cámaras en un galpón de logística para controlar accesos y carga de camiones."</p>
                          <span className="text-[9px] text-slate-500 block text-right mt-1">18:42</span>
                        </div>

                        <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl rounded-tr-none ml-auto max-w-[85%]">
                          <p className="text-emerald-200 leading-relaxed">
                            "¡Buenas tardes! Para galpones de logística te recomendamos cámaras <strong>IP Varifocales Hikvision de 4MP</strong> para lectura de patentes en ingresos, combinadas con domos AcuSense para pasillos internos. Ya generé la solicitud con nuestro especialista comercial para armarte el presupuesto."
                          </p>
                          <span className="text-[9px] text-emerald-400/60 block text-right mt-1">NISSI (IA) · 18:42:03 ✓✓</span>
                        </div>

                        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center gap-3">
                          <Zap className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                          <div>
                            <strong className="text-white block">Acción Automática Realizada:</strong>
                            <span>Lead creado en Pipeline: <em>[Venta] Galpón Logística 8 Cámaras</em>. Asignado a: Juan (Ventas). Transcript adjunto.</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                      <input
                        type="text"
                        disabled
                        placeholder="El bot está gestionando la conversación (hacé clic en 'Tomar Conversación' para escribir)"
                        className="w-full bg-slate-900 text-xs text-slate-500 px-3 py-2 rounded-xl border border-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN 3: PIPELINE KANBAN */}
            {activeScreen === 'pipeline' && (
              <div className="p-4 sm:p-6 text-left">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      Pipeline Comercial · Embudo de Seguridad
                    </h3>
                    <p className="text-xs text-slate-400">Total en Juego: <strong className="text-emerald-400">US$ 28.450</strong> · 18 Oportunidades Activas</p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Filtro: Todo el Equipo
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  {/* Col 1 */}
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                      <span className="font-bold text-slate-300">1. Nuevo Lead (IA)</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">3</span>
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-grab">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">WhatsApp NISSI</span>
                        <p className="font-bold text-white mt-1">Galpón Logística 8 Cámaras</p>
                        <p className="text-[11px] text-slate-400">Distribuidora San Martín</p>
                        <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold">
                          <span className="text-slate-400">Est: US$ 1.840</span>
                          <span className="text-indigo-400">Asig: Juan</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Col 2 */}
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                      <span className="font-bold text-indigo-300">2. Cotización Enviada</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">5</span>
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-900 border border-indigo-500/30 cursor-grab">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">Cotización Flash</span>
                        <p className="font-bold text-white mt-1">Consorcio Torre Alvear</p>
                        <p className="text-[11px] text-slate-400">4 Domos AcuSense + NVR 4K</p>
                        <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold">
                          <span className="text-emerald-400">US$ 732,05</span>
                          <span className="text-indigo-400">Asig: Lucas</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Col 3 */}
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                      <span className="font-bold text-amber-300">3. En Negociación</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">2</span>
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-grab">
                        <span className="text-[10px] font-bold text-amber-400 uppercase">Abono Monitoreo</span>
                        <p className="font-bold text-white mt-1">Fábrica Metalúrgica Sur</p>
                        <p className="text-[11px] text-slate-400">Alarma Garnet + Cerco 200m</p>
                        <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-bold">
                          <span className="text-emerald-400">US$ 3.400</span>
                          <span className="text-indigo-400">Asig: Juan</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Col 4 */}
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                      <span className="font-bold text-emerald-400">4. Ganado / A Instalar</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">8</span>
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 cursor-grab">
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
            )}

            {/* SCREEN 4: DEPÓSITO & CONTEO INICIAL */}
            {activeScreen === 'stock' && (
              <div className="p-4 sm:p-6 text-left">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-400" />
                      Control de Stock & Depósito
                    </h3>
                    <p className="text-xs text-slate-400">Depósito Central · Inventario físico en tiempo real</p>
                  </div>
                  <button className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow">
                    <Sparkles className="w-3.5 h-3.5" /> Conteo Físico Inicial (Sin Factura)
                  </button>
                </div>

                <div className="rounded-xl border border-slate-800 overflow-hidden text-xs">
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
                      <tr>
                        <td className="p-3 font-mono text-indigo-300 font-bold">DH-HAC-HFW1200R</td>
                        <td className="p-3 font-bold text-white">Bullet HDCVI Dahua 2MP 3.6mm IR 20m</td>
                        <td className="p-3 text-slate-400">Dahua</td>
                        <td className="p-3 text-center font-bold">3</td>
                        <td className="p-3 text-center text-amber-400 font-bold">0</td>
                        <td className="p-3 text-center text-red-400 font-black text-sm">3</td>
                        <td className="p-3 text-right"><span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">Stock Crítico</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-center justify-between">
                  <span>💡 <strong>Ventaja única:</strong> Los vendedores ven en tiempo real cuántas unidades están libres sin llamar al pañolero.</span>
                  <span className="font-bold underline cursor-pointer">Ver Órdenes de Entrega</span>
                </div>
              </div>
            )}

            {/* SCREEN 5: FACTURACIÓN ARCA / AFIP */}
            {activeScreen === 'facturacion' && (
              <div className="p-4 sm:p-6 text-left">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-emerald-400" />
                      Facturación Electrónica Oficial ARCA / AFIP
                    </h3>
                    <p className="text-xs text-slate-400">Emisión directa con CAE y QR reglamentario</p>
                  </div>
                  <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                    Servicio AFIP Conectado
                  </span>
                </div>

                {/* Factura A Mock */}
                <div className="bg-white text-slate-900 rounded-2xl p-6 border border-slate-300 shadow-inner max-w-3xl mx-auto font-mono text-xs">
                  <div className="flex justify-between items-center border-b border-slate-400 pb-3 mb-3">
                    <div>
                      <h4 className="text-sm font-black tracking-tight">ABBA SEGURIDAD ELECTRÓNICA S.A.</h4>
                      <p className="text-[10px] text-slate-600">CUIT: 30-71649281-9 · IVA Responsable Inscripto</p>
                    </div>
                    <div className="w-12 h-12 rounded border-2 border-slate-900 flex items-center justify-center font-black text-2xl">
                      A
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xs">FACTURA A</p>
                      <p className="text-[10px]">Nº 0004-00012984</p>
                      <p className="text-[10px] text-slate-600">Fecha: {new Date().toLocaleDateString('es-AR')}</p>
                    </div>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded mb-3 text-[11px]">
                    <p><strong>Cliente:</strong> CONSORCIO TORRE ALVEAR · <strong>CUIT:</strong> 30-68192841-4</p>
                    <p><strong>Condición de Venta:</strong> Cuenta Corriente (15 días) · <strong>Cotización Vinculada:</strong> #PRESUP-842</p>
                  </div>

                  <div className="space-y-1.5 border-b border-slate-300 pb-3 mb-3 text-[11px]">
                    <div className="flex justify-between font-bold text-slate-600">
                      <span>Concepto</span>
                      <span>Total Neto</span>
                    </div>
                    <div className="flex justify-between">
                      <span>4× Domo IP Hikvision AcuSense 2MP + Grabador NVR 8Ch</span>
                      <span>$ 774.400,00</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>IVA Discriminado (21%):</span>
                      <span>$ 162.624,00</span>
                    </div>
                    <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                      <span>TOTAL A PAGAR:</span>
                      <span>$ 937.024,00</span>
                    </div>
                  </div>

                  {/* CAE & QR Barcode */}
                  <div className="flex items-center justify-between text-[10px] text-slate-700 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center font-bold text-[9px] rounded">
                        QR AFIP
                      </div>
                      <div>
                        <p><strong>CAE Nº:</strong> 74182901849201</p>
                        <p><strong>Vto. CAE:</strong> {new Date(Date.now() + 10 * 86400000).toLocaleDateString('es-AR')}</p>
                      </div>
                    </div>
                    <span className="text-emerald-700 font-bold">✓ Comprobante Autorizado por ARCA</span>
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN 6: DASHBOARD EJECUTIVO */}
            {activeScreen === 'dashboard' && (
              <div className="p-4 sm:p-6 text-left">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-400" />
                      Dashboard Ejecutivo · Métricas del Negocio
                    </h3>
                    <p className="text-xs text-slate-400">Rendimiento comercial y abonos de monitoreo en tiempo real</p>
                  </div>
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> +24% vs mes anterior
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400">MRR Abonos Monitoreo</span>
                    <p className="text-2xl font-black text-white mt-1">$ 14.850.000</p>
                    <span className="text-[10px] text-emerald-400">182 clientes abonados activos</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400">Presupuestos Emitidos</span>
                    <p className="text-2xl font-black text-cyan-400 mt-1">48</p>
                    <span className="text-[10px] text-slate-400">Promedio de cierre: 2.8 días</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400">Tasa de Conversión</span>
                    <p className="text-2xl font-black text-emerald-400 mt-1">41.8%</p>
                    <span className="text-[10px] text-emerald-400">+12% gracias al Bot NISSI</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400">Tiempo de Respuesta</span>
                    <p className="text-2xl font-black text-amber-400 mt-1">2.1 seg</p>
                    <span className="text-[10px] text-slate-400">Antes: 3.5 horas</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-white">Ranking de Vendedores del Mes:</strong>
                    <span className="text-slate-400 ml-2">1º Juan ($ 12.4M) · 2º Lucas ($ 9.1M) · 3º Marcos ($ 6.8M)</span>
                  </div>
                  <span className="text-indigo-400 font-bold hover:underline cursor-pointer">Ver reporte analítico completo</span>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ── Pain vs Solution Breakdown (Los Dolores Resueltos) ────────── */}
      <section id="dolores" className="py-24 bg-[#070b14] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400">Fricciones Reales</span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-2">
              El costo oculto de seguir trabajando como en el 2015
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Mirá cómo JustCRM reemplaza cada dolor de cabeza por un flujo automático que ahorra horas de trabajo:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            
            {/* Box 1 */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-red-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold mb-4">
                  01
                </div>
                <h3 className="text-base font-bold text-white mb-2">Lead que espera = Venta perdida</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Si un cliente pide cotización por WhatsApp y pasan 3 horas, le compra a tu competidor. NISSI responde en 2 segundos, orienta técnicamente y deriva al vendedor con el chat completo.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> De 3 horas de espera a 2 segundos
              </div>
            </div>

            {/* Box 2 */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold mb-4">
                  02
                </div>
                <h3 className="text-base font-bold text-white mb-2">45 minutos por presupuesto en Word</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Buscar en Excels del mayorista, calcular el dólar blue a mano y renegar con tablas rotas. Con JustCRM cotizás en 30 segundos con precios Gremio o Público y mandás el PDF en vivo.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Cotizaciones mientras hablás por teléfono
              </div>
            </div>

            {/* Box 3 */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold mb-4">
                  03
                </div>
                <h3 className="text-base font-bold text-white mb-2">Información cautiva en teléfonos personales</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Si el vendedor falta o renuncia, te quedás a ciegas. Con la bandeja compartida oficial, cada mensaje, audio y cotización queda en la ficha del cliente protegida para la empresa.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Soberanía total de la base de clientes
              </div>
            </div>

            {/* Box 4 */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold mb-4">
                  04
                </div>
                <h3 className="text-base font-bold text-white mb-2">Faltantes de piezas en la obra</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  El técnico llega a instalar y faltan baluns o conectores. Las órdenes de entrega desglosan cada componente del kit para el pañol con remito firmado. Cero viajes dobles.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Desglose técnico milimétrico
              </div>
            </div>

            {/* Box 5 */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold mb-4">
                  05
                </div>
                <h3 className="text-base font-bold text-white mb-2">Stock trabado por falta de facturas</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Tenés 20 cámaras en el pañol pero el sistema dice cero porque no cargaron la factura de compra. Con el Conteo Físico Inicial cargás tus estanterías en 1 clic y empezás a vender.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Depósito operativo en 2 horas
              </div>
            </div>

            {/* Box 6 */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold mb-4">
                  06
                </div>
                <h3 className="text-base font-bold text-white mb-2">Cruce eterno de comprobantes de abonos</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Nadie sabe quién pagó el abono de monitoreo del mes. Con el Portal de Clientes y la facturación automática ARCA/AFIP, tus clientes pagan online y descargan sus comprobantes solos.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Cobranzas en piloto automático
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Planes de Suscripción ─────────────────────────────────────── */}
      <section id="planes" className="py-24 bg-slate-950 border-t border-slate-800 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Inversión Directa</span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-2">
              Planes claros para escalar tu empresa
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
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Catálogo de productos & precios Gremio</li>
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
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Terminá con el Caos Operativo</h2>
          <p className="text-slate-400 text-sm mb-8">
            Completá tus datos y un especialista técnico de JustCreate te contactará hoy mismo para mostrarte el sistema en vivo con tus propios productos.
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Empresa de Seguridad o IoT</label>
              <input
                type="text"
                required
                placeholder="Ej. Abba Seguridad Electrónica"
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
