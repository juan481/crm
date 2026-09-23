'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, ArrowRight, Zap, Bot, FileText, BarChart3,
  Layers, Users, Package, RefreshCw, Send, Check, Sparkles, Building2,
  Clock, ShieldAlert, XCircle, MessageSquare, Flame, CheckCheck,
  ChevronDown, Star, Play, Compass, PhoneCall, HelpCircle, HardDriveDownload
} from 'lucide-react'

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'todos' | 'ventas' | 'operaciones' | 'administracion'>('todos')
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
      desc: 'Grabador digital con 8 puertos PoE integrados. Soporta 2 discos rígidos de hasta 8TB.',
      tipo: 'PRODUCTO',
      cant: 1,
      precioGremio: 195.00,
      precioPublico: 270.00,
    },
    {
      sku: 'KIT-CONECT-04',
      name: 'Kit de Cableado UTP + Baluns + Fuentes Estancas',
      desc: 'Incluye: 100m UTP Cat5e exterior, 8× baluns pasivos, 4× fuentes 12V 2A y conectores.',
      tipo: 'KIT',
      cant: 1,
      precioGremio: 70.00,
      precioPublico: 95.00,
    },
    {
      sku: 'SRV-INST-PUESTA',
      name: 'Mano de Obra Instalación, Cableado y Vinculación App',
      desc: 'Fijación en altura, canalización estética, ponchado, configuración en NVR y app celular Hik-Connect.',
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

  // The 7 Core Pain vs Function Battles
  const painPoints = [
    {
      id: 'respuesta-lenta',
      categoria: 'ventas',
      icono: Clock,
      badge: 'VELOCIDAD COMERCIAL',
      dolorTitulo: 'El cliente pide presupuesto por WhatsApp y espera horas. Para cuando le contestás, ya le compró a tu competencia.',
      dolorDetalle: 'Un prospecto escribe un sábado o a las 19 hs preguntando por un kit de 4 cámaras. El vendedor lo ve al día siguiente o se le pierde entre 40 chats personales. En seguridad electrónica, el 70% de las ventas las cierra quien responde primero.',
      solucionTitulo: 'Respuesta Instantánea con Bot IA (NISSI) + Derivación con Transcript Completo',
      solucionDetalle: 'NISSI (con Gemini 2.5 Flash) contesta en 2 segundos, comprende si el cliente busca cámaras, alarmas o servicio técnico, consulta el catálogo y crea la oportunidad en el Pipeline del vendedor con TODO el chat adjunto como nota. Cero segundos perdidos.',
      impacto: 'Tiempo de respuesta reducido de 4 horas a 2 segundos. +45% en tasa de conversión de leads.'
    },
    {
      id: 'cotizaciones-word',
      categoria: 'ventas',
      icono: FileText,
      badge: 'COTIZADOR FLASH',
      dolorTitulo: 'Tardar 45 minutos por presupuesto en un Word desalineado, buscando precios en un Excel desactualizado.',
      dolorDetalle: 'El vendedor tiene que abrir la lista del mayorista, calcular el dólar blue o MEP a mano, rezar que la fórmula del Excel no esté rota, copiar y pegar a un Word donde se le descalabra la tabla, y exportar un PDF con aspecto amateur. Si tiene 8 cotizaciones, pierde todo el día haciendo burocracia.',
      solucionTitulo: 'Cotizador Inteligente en 30 Segundos + Dólar en Vivo + PDF White-Clean',
      solucionDetalle: 'Seleccionás productos o kits con 1 clic. El sistema conmuta entre precio Gremio o Público automáticamente, actualiza el dólar oficial en tiempo real, desglosa el IVA exacto y genera un PDF corporativo de diseño impecable que se envía por mail con 1 clic.',
      impacto: 'De 45 minutos a 30 segundos por cotización. Cotizás mientras estás hablando por teléfono con el cliente.'
    },
    {
      id: 'informacion-perdida',
      categoria: 'ventas',
      icono: MessageSquare,
      badge: 'BLINDAJE DE INFORMACIÓN',
      dolorTitulo: 'Toda la relación con el cliente está atrapada en el WhatsApp personal del vendedor. Si renuncia, te quedás a ciegas.',
      dolorDetalle: 'Nadie sabe qué precio se le pasó al cliente, qué condiciones se le prometieron ni cuándo hay que llamarlo. Si el vendedor se enferma, falta o se va a trabajar con la competencia, se lleva los contactos, las conversaciones y las ventas en su teléfono.',
      solucionTitulo: 'Bandeja de WhatsApp Omnicanal Compartida + Historial Inmutable',
      solucionDetalle: 'Todo el equipo trabaja sobre el número oficial de la empresa desde el CRM. Cada conversación, nota de cotización y estado queda registrado en la ficha del cliente. Cualquier compañero puede continuar la atención sin preguntarle nada a nadie.',
      impacto: '100% de la información pertenece a la empresa. Transición transparente entre operadores.'
    },
    {
      id: 'telefono-descompuesto',
      categoria: 'operaciones',
      icono: CheckCheck,
      badge: 'OPERACIÓN & INSTALACIÓN',
      dolorTitulo: 'El técnico llega a la obra y le faltan 2 baluns o la fuente no alcanza: teléfono descompuesto entre ventas y pañol.',
      dolorDetalle: 'Ventas avisa por WhatsApp: "armate el kit para mañana". El pañolero agarra lo que encuentra. El instalador llega a la casa o fábrica del cliente, abre la caja y falta el conector de alimentación o el disco rígido. La obra se para, el cliente se queja y perdés plata en viajes.',
      solucionTitulo: 'Órdenes de Entrega con Desglose Milimétrico de Componentes',
      solucionDetalle: 'Al aprobarse un presupuesto, el CRM genera la orden de preparación (`/entregas`). Si cotizaste un "Kit 4 Cámaras", el pañol recibe la lista exacta con código SKU de cada tornillo, fuente, balun y metro de cable necesario, con firma de remito de entrega.',
      impacto: 'Cero viajes duplicados por olvidos. Entregas exactas con trazabilidad por técnico.'
    },
    {
      id: 'stock-sin-facturas',
      categoria: 'operaciones',
      icono: Package,
      badge: 'DEPÓSITO & STOCK',
      dolorTitulo: 'Tenés 30 cámaras en la estantería del pañol pero el sistema dice "Stock 0" porque nadie cargó las facturas viejas.',
      dolorDetalle: 'Los sistemas contables tradicionales te obligan a ingresar factura por factura de los últimos 6 meses para dar de alta el stock. Mientras tanto, tu equipo no sabe qué hay disponible en depósito y venden productos que no tienen o compran de más al mayorista.',
      solucionTitulo: 'Módulo de Conteo Inicial Físico sin Factura previa',
      solucionDetalle: 'Vas al depósito, contás físicamente cuántos grabadores, cámaras o sensores tenés, y los cargás con 1 clic en el CRM mediante el Conteo Inicial. El stock queda operativo de inmediato para que los vendedores lo vean en tiempo real al cotizar.',
      impacto: 'Inventario 100% operativo en menos de 2 horas. Ni un solo peso inmovilizado por burocracia contable.'
    },
    {
      id: 'cobranzas-abonos',
      categoria: 'administracion',
      icono: ShieldAlert,
      badge: 'FINANZAS & COBRANZAS',
      dolorTitulo: 'Nadie sabe con certeza quién pagó el abono mensual de monitoreo y quién debe 3 meses: cruce eterno de comprobantes.',
      dolorDetalle: 'Administración gasta días enteros buscando transferencias en el banco y pidiendo comprobantes por WhatsApp. Los clientes que adeudan abonos siguen teniendo servicio técnico gratuito porque los técnicos no saben que están en mora.',
      solucionTitulo: 'Facturación ARCA/AFIP 1-Clic + Cuentas Corrientes + Portal de Clientes',
      solucionDetalle: 'Convertí cotizaciones ganadas en Facturas oficiales A, B o C con CAE en segundos. Los clientes tienen su propio Portal de Autogestión (`/portal`) para descargar sus facturas y ver su estado de cuenta, y el técnico ve si el cliente está al día antes de ir a reparar.',
      impacto: 'Cobranzas al día. Reducción del 80% en tiempo administrativo de conciliación bancaria.'
    },
    {
      id: 'islas-incomunicadas',
      categoria: 'administracion',
      icono: Users,
      badge: 'ALINEACIÓN TOTAL',
      dolorTitulo: 'Tu empresa opera como 3 islas aisladas: Ventas promete, Técnica sufre y Administración no puede cobrar.',
      dolorDetalle: 'El vendedor no sabe si hay técnicos disponibles antes de prometer una fecha. Técnica instala pero no le avisa a Administración para que facture. Administración reclama facturas a un cliente que está furioso porque una cámara no le anda.',
      solucionTitulo: 'Un Único Ecosistema donde Toda la Empresa habla el Mismo Idioma',
      solucionDetalle: 'Desde el primer "Hola" por WhatsApp hasta la firma del remito, la emisión de la factura electrónica y la encuesta de satisfacción del ticket, cada paso ocurre en la misma línea de tiempo visible para toda la empresa con roles y permisos específicos.',
      impacto: 'Fin del caos interno. El dueño y los gerentes tienen el control absoluto en un solo dashboard.'
    }
  ]

  const filteredPains = activeTab === 'todos' 
    ? painPoints 
    : painPoints.filter(p => p.categoria === activeTab)

  const faqs = [
    {
      q: '¿Por qué JustCRM resuelve el dolor de respuesta lenta mejor que tener a alguien atendiendo WhatsApp?',
      a: 'Porque una persona física no puede responder 24/7 en 2 segundos, ni atender 5 consultas simultáneas a las 23:00 hs de un domingo. El Bot NISSI con Gemini 2.5 comprende lenguaje natural, evacúa dudas técnicas sobre cámaras IP, analítica perimetral o centrales de alarma al instante, y le deja al vendedor el lead calificado con la transcripción completa del chat listo para cerrar.'
    },
    {
      q: '¿Cómo evita JustCRM que los técnicos olviden materiales para las instalaciones?',
      a: 'A través de las Órdenes de Entrega generadas automáticamente desde la cotización aprobada. Si cotizás un "Kit 4 Cámaras", el CRM no solo le muestra el kit al cliente; desglosa para el pañol la lista de preparación con cada código SKU (baluns, fuentes, conectores, cable). El pañolero prepara la caja y el técnico firma la recepción digital.'
    },
    {
      q: '¿Realmente puedo cargar mi stock si no tengo las facturas de compra anteriores?',
      a: 'Sí, 100%. Implementamos la función exclusiva de "Conteo Inicial de Stock". Entendemos la realidad de las empresas de seguridad en Argentina: tenés mercadería que compraste hace meses. Con JustCRM podés contar físicamente tus estanterías y asentar el inventario real en 1 clic para empezar a vender inmediatamente.'
    },
    {
      q: '¿Cómo funciona la cotización con dólar y pesos?',
      a: 'El cotizador lee la cotización del dólar oficial en tiempo real. Podés armar el presupuesto en Dólares (estándar de CCTV y alarmas importadas) y con un solo interruptor ver el equivalente en Pesos Argentinos con IVA del 21% o 10.5% discriminado. El PDF se imprime con el tipo de cambio congelado a la fecha para evitar discusiones con el cliente.'
    },
    {
      q: '¿Los vendedores pueden ver las ventas o clientes de sus compañeros?',
      a: 'No, a menos que vos lo autorices. El sistema cuenta con una matriz de roles estricta: los Vendedores (`SELLER`) solo tienen acceso a sus propios prospectos, tratos y cotizaciones. Los Gerentes y Administradores tienen la vista panorámica de todo el equipo y métricas globales.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#080c15] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased overflow-x-hidden">
      
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#080c15]/90 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                JustCRM <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">Cero Caos Operativo</span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium -mt-0.5">by JustCreate</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#dolores" className="hover:text-white transition-colors">Los Dolores que Eliminamos</a>
            <a href="#cotizador-demo" className="hover:text-white transition-colors">Cotizador en 30 Seg</a>
            <a href="#bot-ia" className="hover:text-white transition-colors">Bot con IA</a>
            <a href="#planes" className="hover:text-white transition-colors">Planes</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              Ingresar
            </Link>
            <a
              href="#contacto"
              className="text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-indigo-600 to-indigo-700 hover:from-red-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span>Terminar con el Caos</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero: Atacando el Dolor de Cabeza Central ─────────────────── */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden text-center">
        {/* Glow ambient effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-gradient-to-tr from-red-600/15 via-indigo-600/20 to-cyan-500/10 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/60 border border-red-500/30 text-xs font-bold text-red-300 mb-8 shadow-inner">
            <Flame className="w-3.5 h-3.5 text-red-400" />
            <span>¿Cuánto dinero pierde tu empresa de seguridad por responder tarde y gestionar a ciegas?</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.08] mb-6">
            El antídoto definitivo contra el caos interno, <br className="hidden sm:inline" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-indigo-300 to-cyan-300">
              la lentitud de respuesta y la información perdida.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
            Si tu cliente espera horas un presupuesto, si cotizar te toma 45 minutos en un Word, si los instaladores llegan a la obra y les faltan piezas, y si cada vendedor atiende desde su WhatsApp personal sin dejar registro... <strong className="text-white font-semibold">tu problema no es de ventas: es de fricción operativa.</strong>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="#contacto"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
            >
              <span>Agendar Demo y Optimizar mi Operación</span>
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#dolores"
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-base border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Ver los 7 Dolores que Destruimos</span>
            </a>
          </div>

          {/* Quick Metrics Bar: The 3 Core Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Respuesta en 2 Segundos</h4>
                <p className="text-xs text-slate-400 mt-1">El bot con IA califica y deriva al instante. Nunca más un lead enfriándose en WhatsApp.</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Cotizaciones en 30 Segundos</h4>
                <p className="text-xs text-slate-400 mt-1">Buscador instantáneo por SKU, precios Gremio/Público, dólar oficial y PDF White-Clean.</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Cero Información Perdida</h4>
                <p className="text-xs text-slate-400 mt-1">Ventas, Pañol, Instaladores y Finanzas en la misma sintonía con tareas detalladas al milímetro.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The 7 Dolores de Cabeza vs Funciones JustCRM ──────────────── */}
      <section id="dolores" className="py-24 bg-slate-950 border-t border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center justify-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Diagnóstico Operativo
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white">
              Los 7 Dolores de Cabeza que están frenando a tu empresa
            </h2>
            <p className="text-slate-400 mt-4 text-base">
              Identificá los cuellos de botella que hoy te cuestan horas de estrés, clientes perdidos y desorganización interna:
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex justify-center gap-2 mb-12">
            {[
              { id: 'todos', label: 'Todos los Dolores' },
              { id: 'ventas', label: 'Ventas & Clientes' },
              { id: 'operaciones', label: 'Técnica & Depósito' },
              { id: 'administracion', label: 'Cobranzas & Gestión' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Pain Cards List */}
          <div className="space-y-8 max-w-5xl mx-auto">
            {filteredPains.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center font-bold text-xs">
                      #{idx + 1}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {item.badge}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Solución Resuelta
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: The Pain (El Dolor) */}
                  <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/20 text-left">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider mb-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span>El Dolor de Cabeza</span>
                    </div>
                    <h4 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                      {item.dolorTitulo}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {item.dolorDetalle}
                    </p>
                  </div>

                  {/* Right: The JustCRM Function (La Solución) */}
                  <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-left">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Cómo lo Destruye JustCRM</span>
                    </div>
                    <h4 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                      {item.solucionTitulo}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      {item.solucionDetalle}
                    </p>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 font-semibold flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span><strong>Impacto directo:</strong> {item.impacto}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Interactive Live Cotizador: Cómo se ve la Solución ───────── */}
      <section id="cotizador-demo" className="py-24 bg-[#080c15] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Demostración en Tiempo Real</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-2">
              Cotizá mientras hablás por teléfono con el cliente
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Nunca más abras un Word ni busques en listas rotas de Excel. Probá el cotizador dinámico:
            </p>
          </div>

          <div className="max-w-5xl mx-auto bg-slate-900/90 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-400">Condición Comercial:</span>
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
                  <div className="col-span-6">Ítem & Código SKU</div>
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
                <p>✓ Cotización con validez técnica de 15 días.</p>
                <p className="font-semibold text-indigo-600">PDF White-Clean Engine · Sin recuadros blancos feos</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                ⚡ Creado para que el cliente lo reciba en su bandeja de entrada antes de colgar la llamada.
              </div>
              <a
                href="#contacto"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow"
              >
                <span>Quiero este cotizador en mi empresa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── WhatsApp Bot NISSI Deep Dive ──────────────────────────────── */}
      <section id="bot-ia" className="py-24 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-3">
                <Bot className="w-4 h-4 text-emerald-400" />
                Inteligencia Artificial Especializada
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-6">
                El Bot NISSI no inventa precios: asesora técnicamente y deriva con transcript.
              </h2>
              <p className="text-slate-300 text-base leading-relaxed mb-6">
                La mayoría de los chatbots frustran a los clientes porque dan respuestas genéricas o tiran precios inventados. 
                <strong>NISSI</strong> está entrenado para la realidad de la seguridad electrónica:
              </p>

              <div className="space-y-4 text-sm text-slate-300">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Conoce tu Catálogo en Tiempo Real:</strong> Explica diferencias entre cámaras analógicas e IP, analítica AcuSense, distancias infrarrojas y compatibilidad de grabadores.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Derivación Quirúrgica por Departamento:</strong> Si el cliente quiere comprar, crea un Lead en el Pipeline del vendedor. Si tiene una falla técnica, abre un Ticket de soporte. Cero confusión.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Takeover Humano con 1 Clic:</strong> Si un asesor quiere responder, toma el chat desde el CRM y el bot se silencia al instante.
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-white">Conversación en Vivo · WhatsApp Cloud API</span>
                </div>
                <span className="text-xs text-slate-500 font-mono">Motor: Gemini 2.5 Flash</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl rounded-tl-none border border-slate-800 max-w-[85%] text-left">
                  <p className="text-slate-300">"Hola, necesitamos poner 8 cámaras en un galpón de logística para controlar carga de camiones. ¿Qué conviene?"</p>
                  <span className="text-[9px] text-slate-500 block text-right mt-1">Cliente · 18:42</span>
                </div>

                <div className="bg-emerald-950/40 border border-emerald-500/30 p-3.5 rounded-xl rounded-tr-none ml-auto max-w-[90%] text-left">
                  <p className="text-emerald-200">
                    "¡Buenas tardes! Para galpones de logística recomendamos cámaras <strong>IP Varifocales de 4MP</strong> para cubrir accesos de camiones y lectura de patentes, combinadas con domos fijos para pasillos. Te derivo ahora mismo con nuestro ingeniero comercial para armarte el proyecto a medida."
                  </p>
                  <span className="text-[9px] text-emerald-400/60 block text-right mt-1">NISSI (IA) · 18:42 (2 segundos después)</span>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 text-left flex items-start gap-2">
                  <Zap className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Acción del Sistema Ejecutada:</p>
                    <p className="text-[11px] text-indigo-200 mt-0.5">Oportunidad creada en el Pipeline: <strong>[Ventas] Galpón Logística 8 Cámaras</strong>. Transcripción completa pegada en la nota.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Planes de Suscripción ─────────────────────────────────────── */}
      <section id="planes" className="py-24 bg-[#080c15] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Inversión Transparente</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-2">
              Menos de lo que perdés con una sola venta caída
            </h2>
            <p className="text-slate-400 mt-3 text-base">
              Elegí el plan que mejor se adapte al tamaño de tu empresa y activalo hoy mismo con JustCreate.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter */}
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all text-left">
              <div>
                <h3 className="text-xl font-bold text-white">Starter Instalador</h3>
                <p className="text-xs text-slate-400 mt-1">Para técnicos independientes y equipos chicos de hasta 3 personas.</p>
                <div className="mt-6 mb-6">
                  <span className="text-3xl font-extrabold text-white">Consultar</span>
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
                className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs text-center transition-all"
              >
                Solicitar Cotización Starter
              </a>
            </div>

            {/* Plan Pro con Bot IA (Destacado) */}
            <div className="rounded-3xl bg-gradient-to-b from-indigo-950/60 via-slate-900 to-slate-900 border-2 border-indigo-500 p-8 flex flex-col justify-between shadow-2xl relative text-left">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-red-500 via-indigo-500 to-cyan-400 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow">
                MÁS ELEGIDO POR EMPRESAS
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Security Pro & Bot IA</h3>
                <p className="text-xs text-slate-300 mt-1">Para empresas de seguridad, monitoreo y CCTV que quieren escalar.</p>
                <div className="mt-6 mb-6">
                  <span className="text-3xl font-extrabold text-white">Plan Pro</span>
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
                className="mt-8 w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-slate-950 font-extrabold text-xs text-center shadow-lg transition-all"
              >
                Comenzar con Plan Pro
              </a>
            </div>

            {/* Enterprise */}
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all text-left">
              <div>
                <h3 className="text-xl font-bold text-white">Enterprise White-Label</h3>
                <p className="text-xs text-slate-400 mt-1">Para grandes integradores, franquicias o múltiples depósitos.</p>
                <div className="mt-6 mb-6">
                  <span className="text-3xl font-extrabold text-white">A Medida</span>
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

      {/* ── Final Call to Action / Formulario ─────────────────────────── */}
      <section id="contacto" className="py-24 bg-gradient-to-b from-[#080c15] to-slate-950 border-t border-slate-800 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-500 via-indigo-600 to-cyan-400 flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Zap className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Basta de perder tiempo y dinero en tareas manuales
          </h2>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-10">
            Completá tus datos y un especialista de JustCreate te contactará hoy mismo para mostrarte el sistema funcionando en vivo con los productos reales de tu empresa.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              alert('¡Gracias por tu interés! Un especialista de JustCreate te contactará a la brevedad.')
            }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl max-w-xl mx-auto text-left space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tu Nombre y Apellido</label>
              <input
                type="text"
                required
                placeholder="Ej. Juan Pérez"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nombre de tu Empresa de Seguridad o IoT</label>
              <input
                type="text"
                required
                placeholder="Ej. Securitas, Abba Seguridad, etc."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Corporativo</label>
                <input
                  type="email"
                  required
                  placeholder="juan@seguridad.com"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">WhatsApp de Contacto</label>
                <input
                  type="tel"
                  required
                  placeholder="+54 9 11 ..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-4 rounded-xl bg-gradient-to-r from-red-600 via-indigo-600 to-cyan-500 hover:from-red-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5"
            >
              Agendar Demostración y Eliminar el Caos
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
            <a href="#dolores" className="hover:text-slate-300 transition-colors">Dolores Operativos</a>
            <a href="#planes" className="hover:text-slate-300 transition-colors">Planes</a>
            <a href="mailto:contacto@justcreate.com.ar" className="hover:text-slate-300 transition-colors">contacto@justcreate.com.ar</a>
          </div>

          <p>© {new Date().getFullYear()} JustCRM. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
