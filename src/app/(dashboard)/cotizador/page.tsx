'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Minus, MessageCircle, ChevronRight, ChevronLeft, Trash2, Zap, RefreshCw,
  DollarSign, Download, X, Building2, User, FileText, Mail, Send,
  TrendingUp, CheckCircle, Search, Package, Wrench, Tag, Clock, Boxes,
  ShoppingCart, UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Pagination } from '@/components/ui/table'
import { formatMoneyExact } from '@/lib/utils'
import { computeQuoteTotals, sanitizeIvaPct, DEFAULT_IVA_PCT, type QuoteTotals } from '@/lib/quote-totals'
import { loadLogoForPdf, drawPdfHeader, drawValidityNote, drawNotesBox, drawBrandedFooter, drawQuoteTotalsBox } from '@/lib/pdf-branding'
import { sanitizePdfText } from '@/lib/pdf-text'
import { useThemeStore } from '@/store/theme-store'
import { CatalogFilters } from '@/components/catalogo/catalog-filters'
import { ProductCard } from '@/components/catalogo/product-card'
import { ProductDetailModal } from '@/components/catalogo/product-detail-modal'
import type { Service, Product, ProductCategory, ProductBrand } from '@/types'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────

const BILLING_LABELS: Record<string, string> = {
  MONTHLY:  'mes',
  ANNUAL:   'año',
  ONE_TIME: 'único',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExchangeRate { venta: number; compra: number; updatedAt: string }

type ItemType = 'SERVICE' | 'PRODUCT'
interface CartItem {
  type:     ItemType
  item:     Service | Product
  quantity: number
  // Precio unitario propio de ESTA cotización — pisa el del catálogo. Sirve
  // para servicios que valen distinto según el trabajo (ej. "Instalación").
  // null/undefined = usar el precio del catálogo.
  priceOverride?: number | null
}

// 'PUBLICO' | 'GREMIO' — a qué lista de precios cotizar (Módulo 2, catálogo
// Gremio/Público). Sólo afecta productos de catálogo con precioGremio
// cargado; Service y productos "simples" (precioGremio null) siempre usan
// item.price sin importar el modo — backward-compatible por construcción.
type PriceMode = 'PUBLICO' | 'GREMIO'

const itemKey  = (type: ItemType, id: string) => `${type}_${id}`
function getUnitPrice(type: ItemType, item: Service | Product, mode: PriceMode): number {
  if (type === 'PRODUCT' && mode === 'GREMIO') {
    const precioGremio = (item as Product).precioGremio
    if (precioGremio != null) return precioGremio
  }
  return item.price
}
const getPrice = (ci: CartItem, mode: PriceMode) =>
  (ci.priceOverride != null && Number.isFinite(ci.priceOverride))
    ? ci.priceOverride
    : getUnitPrice(ci.type, ci.item, mode)
const getCurrency = (ci: CartItem) => ci.item.currency

interface SavedQuote {
  cotizacionId:   string
  dealId:         string | null
  ref:            string
  orgName:        string
  primaryColor:   string
  logoUrl:        string | null
  agentName:      string
  recipientName:  string
  recipientEmail: string
  empresaName?:   string
  cartItems:      CartItem[]
  subtotal:       number
  discount:       number
  finalTotal:     number
  ivaDiscriminado: boolean
  totals:         QuoteTotals
  currency:       string
  notes:          string
  validityDays:   number
  priceMode:      PriceMode
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CotizadorPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [cart,       setCart]       = useState<Record<string, CartItem>>({})
  const [activeTab,  setActiveTab]  = useState<ItemType>('SERVICE')
  const [discount,   setDiscount]   = useState(0)
  // IVA discriminado: el precio del catálogo es NETO; con esto activado el
  // PDF/preview discrimina el IVA por alícuota y el total lo incluye.
  const [ivaDiscriminado, setIvaDiscriminado] = useState(true)
  const [validityDays, setValidityDays] = useState(30)
  const [validityTouched, setValidityTouched] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [priceMode, setPriceMode] = useState<PriceMode>('PUBLICO')
  // Paso 1 rediseñado como grilla completa con foto, no un buscador
  // chiquito con dropdown — categoría y página sólo aplican al catálogo
  // del proveedor (paginado, potencialmente miles de SKUs); servicios y
  // productos "simples" son listas cortas, se muestran completas y se
  // filtran en memoria con itemSearch directo.
  const [productCategoryId, setProductCategoryId] = useState<string | null>(null)
  const [productBrand, setProductBrand] = useState<string | null>(null)
  const [productPage, setProductPage] = useState(1)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const PRODUCT_GRID_LIMIT = 24

  // Wizard de 3 pantallas — antes todo (ítems, descuento, validez,
  // destinatario, notas) vivía en una sola página larga y "Destinatario"
  // terminaba muy abajo del scroll, después de una grilla de miles de SKUs.
  // Cada paso ahora es su propia pantalla; sólo se avanza desde el botón de
  // la barra inferior, nunca haciendo scroll.
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const logoUrl = useThemeStore((s) => s.logoUrl)

  // Debounce sólo para la búsqueda contra el catálogo (server-side, miles
  // de SKUs) — los servicios y productos "simples" siguen filtrándose en
  // memoria con itemSearch directo, sin debounce, como siempre.
  const [debouncedItemSearch, setDebouncedItemSearch] = useState('')
  const itemSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    itemSearchDebounceRef.current = setTimeout(() => setDebouncedItemSearch(itemSearch), 300)
    return () => { if (itemSearchDebounceRef.current) clearTimeout(itemSearchDebounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSearch])

  // Cambió el filtro -> volver a la página 1 (si no, se puede quedar en una
  // página que ya no existe para el nuevo resultado).
  useEffect(() => { setProductPage(1) }, [debouncedItemSearch, productCategoryId, productBrand])

  const searchParams = useSearchParams()
  // Presente cuando se llega desde "Generar cotización" en el detalle de una
  // oportunidad de Pipeline — vincula la cotización a ese deal existente en
  // vez de ofrecer crear uno nuevo al guardar.
  const dealId = searchParams.get('dealId') ?? null
  const [clientMode,              setClientMode]              = useState<'existing' | 'manual'>('existing')
  const [selectedEmpresaId,       setSelectedEmpresaId]       = useState(() => searchParams.get('empresaId') ?? '')
  // Búsqueda directa de contacto (persona), independiente de elegir una
  // empresa primero — la mayoría de los leads de WhatsApp son consumidor
  // final sin empresa cargada, y antes no había forma de encontrarlos acá
  // (el flujo exigía Empresa → sus contactos). Ver ContactoSearchResult más
  // abajo y el bloque "Buscar contacto" en el paso 2.
  const [contactSearch,           setContactSearch]           = useState('')
  const [selectedContactEmail,    setSelectedContactEmail]    = useState('')
  const [selectedContactName,     setSelectedContactName]     = useState('')
  // Alta rápida sin salir del cotizador — pedido de Abba: si el cliente no
  // existe en el CRM (o existe sin mail cargado, ver contactSearchResults
  // más abajo), antes no había forma de avanzar sin ir a Contactos aparte.
  const [showNewContactForm,      setShowNewContactForm]      = useState(false)
  const [newContactFirstName,     setNewContactFirstName]     = useState('')
  const [newContactLastName,      setNewContactLastName]      = useState('')
  const [newContactEmail,         setNewContactEmail]         = useState('')
  const [newContactPhone,         setNewContactPhone]         = useState('')
  const [creatingContact,         setCreatingContact]         = useState(false)
  // Completar el mail de un contacto EXISTENTE que ya está cargado en el CRM
  // pero sin mail (pasa seguido con contactos viejos) — antes esos contactos
  // quedaban directamente escondidos de la búsqueda y de la lista por
  // empresa, obligando a tipearlo suelto cada vez sin que quedara guardado.
  // Ahora se completa ahí mismo y se guarda de verdad en Contactos.
  const [fixingContact,           setFixingContact]           = useState<{ id: string; firstName: string; lastName: string; empresaId: string | null } | null>(null)
  const [fixEmailValue,           setFixEmailValue]           = useState('')
  const [savingFixEmail,          setSavingFixEmail]          = useState(false)
  const [manualContactInput,      setManualContactInput]      = useState(false)
  const [manualEmail,             setManualEmail]             = useState('')
  const [manualName,              setManualName]              = useState('')
  const [notes,                   setNotes]                   = useState('')
  const [saving,                  setSaving]                  = useState(false)
  const [sendingEmail,            setSendingEmail]            = useState(false)
  const [showArs,                 setShowArs]                 = useState(false)
  // Antes preguntaba "¿Agregar al Pipeline?" con botones Sí/No — ahora se
  // agrega solo al guardar la cotización (ver handleSave) y esto sólo
  // trackea el estado para mostrarlo, más la opción de deshacerlo.
  const [pipelineBusy,  setPipelineBusy]  = useState(false)
  const [pipelineState, setPipelineState] = useState<'idle' | 'added' | 'removed' | 'error'>('idle')
  const [autoDealId,    setAutoDealId]    = useState<string | null>(null)

  const [savedQuote,  setSavedQuote]  = useState<SavedQuote | null>(null)
  const [pdfBlobUrl,  setPdfBlobUrl]  = useState<string | null>(null)
  const [pdfBase64,   setPdfBase64]   = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => { return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl) } }, [pdfBlobUrl])

  // Precarga desde una cotización existente — pedido de Abba: "Duplicar"
  // (cotizaciones/[id]) armaba una copia, pero esa pantalla es sólo de
  // ver/cambiar estado, no tiene forma de editar los ítems. Ahora Duplicar
  // manda para acá con ?duplicarDe=<id>, se trae la cotización, se carga el
  // carrito con exactamente lo mismo (precio "congelado" al de esa
  // cotización, no el del catálogo actual) y el vendedor corrige lo que
  // esté mal antes de generar el presupuesto nuevo.
  const duplicarDe = searchParams.get('duplicarDe')
  useEffect(() => {
    if (!duplicarDe) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/cotizaciones/${duplicarDe}`)
        const json = await r.json()
        if (!r.ok || cancelled) return
        const cot = json.data
        const items = Array.isArray(cot.items) ? cot.items : []
        const nextCart: Record<string, CartItem> = {}
        items.forEach((it: any, idx: number) => {
          const type: ItemType = it.type === 'PRODUCT' ? 'PRODUCT' : 'SERVICE'
          const id = it.productId || it.serviceId || `dup-${idx}`
          const item: any = {
            id, name: it.name, description: it.description ?? null,
            price: it.price, currency: it.currency, ivaPct: it.ivaPct ?? null,
            ...(type === 'PRODUCT'
              ? { sku: it.sku ?? null, mpn: it.mpn ?? null, unit: it.unit ?? 'unidad', isKit: !!it.isKit, kitComponents: it.kitComponents ?? [], precioGremio: null }
              : { billingCycle: it.billingCycle ?? 'MONTHLY' }),
          }
          nextCart[itemKey(type, id)] = { type, item, quantity: it.quantity ?? 1, priceOverride: it.price }
        })
        if (cancelled) return
        setCart(nextCart)
        setSelectedEmpresaId(cot.empresaId ?? '')
        setSelectedContactEmail(cot.recipientEmail ?? '')
        setSelectedContactName(cot.recipientName ?? '')
        if (!cot.empresaId) { setClientMode('manual'); setManualEmail(cot.recipientEmail ?? ''); setManualName(cot.recipientName ?? '') }
        setNotes(cot.notes ?? '')
        setDiscount(cot.discount ?? 0)
        setPriceMode(cot.priceMode === 'GREMIO' ? 'GREMIO' : 'PUBLICO')
        setIvaDiscriminado(cot.ivaDiscriminado === true)
        toast.success(`Cargado desde ${cot.ref} — revisá y corregí antes de generar el nuevo presupuesto.`)
      } catch {
        toast.error('No se pudo cargar la cotización para duplicar')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicarDe])

  // ── Queries ────────────────────────────────────────────────────────────────
  // Antes: `.json().then(j => j.data as Service[])` sin chequear `r.ok` —
  // si el fetch fallaba (401/500), la promesa igual resolvía OK (con
  // `j.data === undefined`), react-query nunca marcaba `isError`, y el
  // catálogo quedaba en silencio como "Sin servicios/productos
  // configurados" — indistinguible de una organización que genuinamente no
  // cargó nada. Ahora un fetch fallido tira, así isError se puede mostrar.
  const { data: servicesData, isLoading: loadingServices, isError: errorServices } = useQuery({
    queryKey: ['services'],
    queryFn:  async () => {
      const r = await fetch('/api/services')
      if (!r.ok) throw new Error('Error al cargar servicios')
      return (await r.json()).data as Service[]
    },
  })
  // scope=simple — productos cargados a mano (pocos). El catálogo del
  // proveedor (potencialmente miles de SKUs) se busca aparte, server-side,
  // ver catalogSearchData más abajo — cargarlo entero acá y filtrar en
  // memoria (como antes) dejó de ser viable.
  const { data: productsData, isLoading: loadingProducts, isError: errorProducts } = useQuery({
    queryKey: ['products', 'simple'],
    queryFn:  async () => {
      const r = await fetch('/api/products?scope=simple')
      if (!r.ok) throw new Error('Error al cargar productos')
      return (await r.json()).data as Product[]
    },
  })
  const { data: catalogGridData, isLoading: loadingCatalogGrid } = useQuery({
    queryKey: ['catalogo-grid-cotizador', debouncedItemSearch, productCategoryId, productBrand, productPage],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(productPage), limit: String(PRODUCT_GRID_LIMIT) })
      if (debouncedItemSearch.length >= 2) p.set('q', debouncedItemSearch)
      if (productCategoryId) p.set('categoryId', productCategoryId)
      if (productBrand) p.set('brand', productBrand)
      const r = await fetch(`/api/catalogo/products?${p}`)
      if (!r.ok) return { data: [], total: 0, totalPages: 1 }
      return r.json()
    },
    enabled: activeTab === 'PRODUCT',
    staleTime: 30_000,
  })
  const { data: productCategoriesData } = useQuery({
    queryKey: ['catalogo-categorias-cotizador'],
    queryFn: async () => {
      const r = await fetch('/api/catalogo/categories')
      if (!r.ok) return { data: [] }
      return r.json()
    },
    enabled: activeTab === 'PRODUCT',
    staleTime: 5 * 60_000,
  })
  const { data: productBrandsData } = useQuery({
    queryKey: ['catalogo-marcas-cotizador'],
    queryFn: async () => {
      const r = await fetch('/api/catalogo/brands')
      if (!r.ok) return { data: [] }
      return r.json()
    },
    enabled: activeTab === 'PRODUCT',
    staleTime: 5 * 60_000,
  })
  const { data: empresasData } = useQuery({
    queryKey: ['empresas-cotizador'],
    queryFn:  async () => {
      const r = await fetch('/api/empresas/options')
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Array<{ id: string; name: string; city?: string | null }>
    },
    staleTime: 5 * 60_000,
  })
  const { data: contactsData } = useQuery({
    queryKey: ['contactos-empresa-cot', selectedEmpresaId],
    queryFn:  async () => {
      const r = await fetch(`/api/contactos?empresaId=${selectedEmpresaId}&limit=50`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Array<{ id: string; firstName: string; lastName: string; email: string | null }>
    },
    enabled:   !!selectedEmpresaId && clientMode === 'existing',
    staleTime: 2 * 60_000,
  })
  const { data: contactSearchData } = useQuery({
    queryKey: ['contactos-buscar-cot', contactSearch],
    queryFn:  async () => {
      const r = await fetch(`/api/contactos?search=${encodeURIComponent(contactSearch)}&limit=10`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Array<{
        id: string; firstName: string; lastName: string; email: string | null; phone: string | null
        empresa: { id: string; name: string } | null
      }>
    },
    enabled:   clientMode === 'existing' && contactSearch.trim().length >= 2,
    staleTime: 30_000,
  })
  const { data: cotizadorConfig } = useQuery({
    queryKey: ['cotizador-config'],
    queryFn:  async () => {
      const r = await fetch('/api/cotizador/config')
      if (!r.ok) return null
      return (await r.json()).data as { quoteValidityDays: number } | null
    },
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (cotizadorConfig?.quoteValidityDays && !validityTouched) {
      setValidityDays(cotizadorConfig.quoteValidityDays)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizadorConfig])

  const { data: rateData, isLoading: loadingRate, refetch: refetchRate } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn:  async () => {
      const r = await fetch('/api/exchange-rate')
      if (!r.ok) return null
      return (await r.json()).data as ExchangeRate
    },
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })

  const arsRate  = rateData?.venta ?? null
  const services = servicesData ?? []
  const products = productsData ?? []
  const catalogGridItems: Product[] = catalogGridData?.data ?? []
  const catalogGridTotal: number = catalogGridData?.total ?? 0
  const catalogGridTotalPages: number = catalogGridData?.totalPages ?? 1
  const productCategories: ProductCategory[] = productCategoriesData?.data ?? []
  const productBrands: ProductBrand[] = productBrandsData?.data ?? []
  const empresas = Array.isArray(empresasData) ? empresasData : []
  // Ya NO se filtran los que no tienen mail — se muestran igual, con la
  // opción de completarlo ahí mismo (ver fixingContact).
  const contacts = Array.isArray(contactsData) ? contactsData : []
  const contactSearchResults = Array.isArray(contactSearchData) ? contactSearchData : []

  // Alta rápida — crea el Contacto en el CRM (Contactos) y lo deja
  // seleccionado como destinatario, sin salir del cotizador.
  const handleCreateContact = async () => {
    // Mail opcional — pedido de Abba: un cliente real (ej. un adulto mayor)
    // puede no tener mail, y eso no tiene por qué frenar la venta. Antes
    // esto era obligatorio y terminaba forzando mails inventados tipo
    // "sin@mail.com" cargados de verdad en el CRM, que después ensuciaban
    // el directorio y encima seguían sin poder mandarse por mail de verdad.
    if (!newContactFirstName.trim() || !newContactLastName.trim()) {
      toast.error('Nombre y apellido son obligatorios')
      return
    }
    setCreatingContact(true)
    try {
      const r = await fetch('/api/contactos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newContactFirstName.trim(), lastName: newContactLastName.trim(),
          email: newContactEmail.trim() || undefined, phone: newContactPhone.trim() || undefined,
          empresaId: selectedEmpresaId || undefined,
        }),
      })
      const json = await r.json()
      if (!r.ok) { toast.error(json.error ?? 'No se pudo crear el cliente'); return }
      const c = json.data
      setSelectedContactEmail(c.email ?? '')
      setSelectedContactName(`${c.firstName} ${c.lastName}`.trim())
      if (c.empresa?.id) setSelectedEmpresaId(c.empresa.id)
      setContactSearch('')
      setShowNewContactForm(false)
      setNewContactFirstName(''); setNewContactLastName(''); setNewContactEmail(''); setNewContactPhone('')
      toast.success(`${c.firstName} ${c.lastName} cargado como cliente nuevo`)
    } catch { toast.error('Error de conexión') } finally { setCreatingContact(false) }
  }

  // Completa el mail de un contacto que YA existe en el CRM pero no lo
  // tenía cargado — lo guarda de verdad (PUT /api/contactos/[id]), no es un
  // dato suelto que se pierde al salir del cotizador.
  const handleSaveFixEmail = async () => {
    if (!fixingContact || !fixEmailValue.trim()) return
    setSavingFixEmail(true)
    try {
      const r = await fetch(`/api/contactos/${fixingContact.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: fixingContact.firstName, lastName: fixingContact.lastName,
          email: fixEmailValue.trim(), empresaId: fixingContact.empresaId,
        }),
      })
      const json = await r.json()
      if (!r.ok) { toast.error(json.error ?? 'No se pudo guardar el mail'); return }
      const c = json.data
      setSelectedContactEmail(c.email ?? '')
      setSelectedContactName(`${c.firstName} ${c.lastName}`.trim())
      if (c.empresa?.id) setSelectedEmpresaId(c.empresa.id)
      setManualContactInput(false)
      setContactSearch('')
      setFixingContact(null)
      setFixEmailValue('')
      toast.success('Mail guardado')
    } catch { toast.error('Error de conexión') } finally { setSavingFixEmail(false) }
  }

  const cartItems  = Object.values(cart)
  const ivaRateFor = (ci: CartItem) => ci.type === 'PRODUCT' ? sanitizeIvaPct((ci.item as Product).ivaPct) : DEFAULT_IVA_PCT
  const quoteLines = cartItems.map(ci => ({ price: getPrice(ci, priceMode), quantity: ci.quantity, ivaPct: ivaRateFor(ci), type: ci.type }))
  const totals     = computeQuoteTotals(quoteLines, discount, ivaDiscriminado)
  const subtotal   = totals.neto
  const discountAmt = totals.descuentoMonto
  const finalTotal = totals.total
  const currency   = cartItems[0] ? getCurrency(cartItems[0]) : 'USD'
  // Público y Gremio en paralelo (no sólo el que está resuelto por
  // priceMode) — para mostrar los dos valores lado a lado en el resumen del
  // paso 3. Si ningún ítem del carrito tiene precioGremio (sólo servicios
  // y/o productos simples), los dos números dan idénticos — en ese caso no
  // tiene sentido mostrar la comparación, se muestra un único total.
  const subtotalPublico = cartItems.reduce((s, i) => s + getPrice(i, 'PUBLICO') * i.quantity, 0)
  const subtotalGremio  = cartItems.reduce((s, i) => s + getPrice(i, 'GREMIO')  * i.quantity, 0)
  const hasGremioSavings = subtotalGremio < subtotalPublico

  const selectedEmpresa = empresas.find(e => e.id === selectedEmpresaId)

  const formatPrice = (usd: number, cur: string) => {
    if (!showArs || cur !== 'USD' || !arsRate) return formatMoneyExact(usd, cur)
    return `${formatMoneyExact(usd, 'USD')} (${formatMoneyExact(usd * arsRate, 'ARS')})`
  }

  // ── Cart ops ───────────────────────────────────────────────────────────────
  const addItem = (type: ItemType, item: Service | Product) => {
    const k = itemKey(type, item.id)
    if (cartItems.length > 0 && item.currency !== currency) {
      toast.error(`No se pueden mezclar monedas (el carrito está en ${currency})`)
      return
    }
    setCart(p => ({ ...p, [k]: { type, item, quantity: (p[k]?.quantity ?? 0) + 1 } }))
  }
  const removeItem = (key: string) => setCart(p => {
    const ci = p[key]; if (!ci) return p
    if (ci.quantity <= 1) { const n = { ...p }; delete n[key]; return n }
    return { ...p, [key]: { ...ci, quantity: ci.quantity - 1 } }
  })
  const setQty = (key: string, qty: number) => {
    const n = Math.max(1, isNaN(qty) ? 1 : qty)
    setCart(p => p[key] ? { ...p, [key]: { ...p[key], quantity: n } } : p)
  }
  // Precio unitario propio de la cotización. '' → vuelve al del catálogo.
  const setItemPrice = (key: string, raw: string) => {
    const t = raw.trim()
    const n = Number(t)
    const priceOverride = t === '' ? null : (Number.isFinite(n) && n >= 0 ? n : null)
    setCart(p => (p[key] ? { ...p, [key]: { ...p[key], priceOverride } } : p))
  }
  const clearCart = () => setCart({})

  // Servicios y productos "simples" son listas cortas ya cargadas enteras
  // — se filtran en memoria con itemSearch directo, sin debounce ni
  // paginar. El catálogo del proveedor (grilla paginada) ya viene
  // filtrado por el servidor (name/sku/brand/mpn + categoría), no se le
  // vuelve a aplicar el filtro por nombre acá — filtrar de nuevo por
  // nombre dejaría afuera un resultado que matcheó por SKU o marca.
  const filteredServices: Service[] = services.filter(s => !itemSearch || s.name.toLowerCase().includes(itemSearch.toLowerCase()))
  const filteredSimpleProducts: Product[] = products.filter(p => {
    if (!itemSearch) return true
    const q = itemSearch.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
  })

  // El banner grande de "sin nada cargado" sólo aplica a Servicios — el
  // catálogo de Productos puede tener miles de SKUs buscables aunque no
  // haya ningún producto "simple" cargado a mano, así que Productos
  // siempre muestra el buscador en vez de un estado vacío bloqueante.
  const showEmptyCatalogState = activeTab === 'SERVICE' && services.length === 0

  // ── Recipient ──────────────────────────────────────────────────────────────
  // Si la empresa elegida no tiene contactos en el directorio, el form muestra
  // los inputs manuales igual — hay que leer manualEmail/manualName aunque
  // manualContactInput siga en false (antes el email tipeado se ignoraba y el
  // paso "Destinatario" no dejaba avanzar).
  const usaManualContacto = manualContactInput
    || (clientMode === 'existing' && !!selectedEmpresaId && contactsData !== undefined && contacts.length === 0)
  const recipientEmail = clientMode === 'existing'
    ? (usaManualContacto ? manualEmail : selectedContactEmail)
    : manualEmail
  const recipientName = clientMode === 'existing'
    ? (usaManualContacto ? manualName : selectedContactName)
    : manualName

  // ── PDF ────────────────────────────────────────────────────────────────────
  const buildPdf = async (quote: SavedQuote) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = 210, mg = 18, cw = pw - mg * 2

    const hex = (quote.primaryColor ?? '#6366f1').replace('#', '').padEnd(6, '0')
    const pr = parseInt(hex.slice(0, 2), 16)
    const pg = parseInt(hex.slice(2, 4), 16)
    const pb = parseInt(hex.slice(4, 6), 16)

    // Load logo (rasterized to PNG via canvas so any source format renders correctly)
    const logo = await loadLogoForPdf(quote.logoUrl)
    const today = new Date()

    const headerH = drawPdfHeader(doc, {
      pw, mg, pr, pg, pb, logo,
      orgName:   quote.orgName,
      kicker:    'Presupuesto',
      dateLabel: today.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
    })

    let y = headerH + 12
    doc.setTextColor(148, 163, 184); doc.setFontSize(7.5)
    const refLabel = `Ref: ${quote.ref}`
    doc.text(refLabel, mg, y)
    if (quote.priceMode === 'GREMIO') {
      doc.setTextColor(16, 185, 129)
      doc.text('· Precio Gremio', mg + doc.getTextWidth(refLabel) + 3, y)
      doc.setTextColor(148, 163, 184)
    }
    y += 10

    doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(`Estimado/a ${quote.recipientName}:`, mg, y); y += 7
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139)
    doc.text('A continuación encontrará el detalle de los ítems cotizados.', mg, y); y += 12

    y = drawValidityNote(doc, { mg, cw, y, pr, pg, pb, validityDays: quote.validityDays, fromDate: today })

    // Table header
    const tableStartY = y
    doc.setFillColor(pr, pg, pb)
    doc.roundedRect(mg, y, cw, 8.5, 3, 3, 'F')
    doc.rect(mg, y + 4, cw, 4.5, 'F') // quita el redondeo inferior de la cabecera
    
    // Público (pedido de Abba): nunca precio por ítem — sólo lista qué
    // incluye la cotización, el Total Final va únicamente en el pie
    // (drawQuoteTotalsBox con simple:true). Gremio mantiene el desglose.
    const showLinePrices = quote.priceMode !== 'PUBLICO'

    doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
    doc.text('ÍTEM',     mg + 3,        y + 5.8)
    doc.text('TIPO',     mg + cw * 0.54, y + 5.8, { align: 'center' })
    doc.text('CANT.',    mg + cw * 0.72, y + 5.8, { align: 'center' })
    if (showLinePrices) doc.text('TOTAL', mg + cw - 3, y + 5.8, { align: 'right' })
    y += 8.5

    quote.cartItems.forEach((ci, idx) => {
      if (idx > 0) {
        doc.setDrawColor(226, 232, 240); doc.line(mg, y, mg + cw, y)
      }
      
      const isProduct = ci.type === 'PRODUCT'
      const kitComps = isProduct && (ci.item as Product).isKit ? ((ci.item as Product).kitComponents ?? []) : []
      const incluyeStr = kitComps.length
        ? 'Incluye: ' + kitComps.map(c => `${c.quantity}× ${c.component.name}`).join(', ')
        : ''
      // Pedido de Abba: la ficha técnica cruda del proveedor no va en el
      // presupuesto — sólo el título. "Incluye:" de los kits se mantiene.
      const itemDesc = ''
      const itemSku = isProduct ? ((ci.item as Product).sku || (ci.item as Product).mpn) : null
      const nameStr = sanitizePdfText(itemSku ? `[${itemSku}] ${ci.item.name}` : ci.item.name)

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
      const nameLines: string[] = doc.splitTextToSize(nameStr, cw * 0.42)
      doc.setFontSize(7.5)
      const extraLines: string[] = []
      if (itemDesc) extraLines.push(...doc.splitTextToSize(itemDesc, cw * 0.42))
      if (incluyeStr) extraLines.push(...doc.splitTextToSize(sanitizePdfText(incluyeStr), cw * 0.42))

      const rowH = 4 + (nameLines.length * 4) + (extraLines.length ? extraLines.length * 3.2 + 1 : 0) + 4

      const lineTotal = getPrice(ci, quote.priceMode) * ci.quantity
      const priceStr  = formatMoneyExact(lineTotal, quote.currency)
      const typeLabel = ci.type === 'SERVICE'
        ? (BILLING_LABELS[((ci.item as Service).billingCycle ?? 'MONTHLY')] ?? 'mes')
        : `× ${(ci.item as Product).unit}`

      // Draw Name
      doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
      let textY = y + 7.5
      nameLines.forEach(line => {
        doc.text(line, mg + 3, textY)
        textY += 4
      })

      // Draw Extra (Description / Kit)
      if (extraLines.length) {
        doc.setTextColor(100, 116, 139); doc.setFontSize(7.5); doc.setFont('helvetica', 'italic')
        textY -= 1
        extraLines.forEach(line => {
          doc.text(line, mg + 3, textY)
          textY += 3.2
        })
      }

      // Draw Type Badge
      const badgeLabel = ci.type === 'SERVICE' ? 'SERVICIO' : (kitComps.length ? 'KIT' : 'PRODUCTO')
      doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      const badgeW = doc.getTextWidth(badgeLabel) + 6
      const badgeCx = mg + cw * 0.54
      doc.setFillColor(ci.type === 'SERVICE' ? pr : 245, ci.type === 'SERVICE' ? pg : 158, ci.type === 'SERVICE' ? pb : 11)
      doc.roundedRect(badgeCx - badgeW / 2, y + 3, badgeW, 5, 1, 1, 'F')
      doc.setTextColor(255, 255, 255)
      doc.text(badgeLabel, badgeCx, y + 6.8, { align: 'center' })

      // Draw Quantity & Total
      doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.text(`${ci.quantity} ${typeLabel}`, mg + cw * 0.72, y + 7.5, { align: 'center' })
      if (showLinePrices) {
        doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
        doc.text(priceStr, mg + cw - 3, y + 7.5, { align: 'right' })
      }

      y += rowH
    })

    // Borde redondeado alrededor de toda la tabla
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(mg, tableStartY, cw, y - tableStartY, 3, 3, 'S')

    // Totals — subtotal, descuento, neto gravado, IVA por alícuota, TOTAL.
    y += 4
    doc.setDrawColor(226, 232, 240); doc.line(mg, y, mg + cw, y); y += 6
    const boxW = 78
    y = drawQuoteTotalsBox(doc, { x: mg + cw - boxW, y, w: boxW, totals: quote.totals, currency: quote.currency, pr, pg, pb, simple: quote.priceMode === 'PUBLICO' })

    // Notes
    if (quote.notes) {
      y = drawNotesBox(doc, { mg, cw, y, pr, pg, pb, notes: quote.notes, maxY: 297 - 18 - 6 })
    }

    // Footer
    drawBrandedFooter(doc, {
      pw, mg, y: 297 - 18, pr, pg, pb,
      leftText: `${quote.agentName} · ${new Date().toLocaleDateString('es-AR')}`,
    })

    return doc
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (cartItems.length === 0) { toast.error('Seleccioná al menos un ítem'); return }
    // El mail ya NO es obligatorio — pasa con clientes reales que no tienen
    // (pedido de Abba: un adulto mayor sin mail no tiene por qué frenar la
    // venta). Sin mail, la cotización se puede mandar igual por WhatsApp;
    // "Enviar por mail" queda deshabilitado en el paso siguiente.
    if (!recipientName.trim())  { toast.error('Ingresá el nombre del destinatario'); return }

    setSaving(true)
    try {
      // price acá ya es el número RESUELTO (público o gremio, según
      // priceMode), validado server-side de todos modos para catálogo.
      const items = cartItems.map(ci => {
        const isProduct = ci.type === 'PRODUCT'
        const product = ci.item as Product
        return {
          type: ci.type,
          serviceId: ci.type === 'SERVICE' ? ci.item.id : undefined,
          productId: isProduct ? product.id : undefined,
          name: ci.item.name,
          description: ci.item.description ?? null,
          sku: isProduct ? product.sku : null,
          mpn: isProduct ? product.mpn : null,
          isKit: isProduct ? product.isKit : false,
          kitComponents: isProduct && product.isKit ? product.kitComponents : [],
          price: getPrice(ci, priceMode),
          currency: ci.item.currency,
          billingCycle: ci.type === 'SERVICE' ? ((ci.item as Service).billingCycle ?? 'MONTHLY') : undefined,
          unit: isProduct ? product.unit : undefined,
          quantity: ci.quantity,
          ivaPct: ivaRateFor(ci),
        }
      })

      const res  = await fetch('/api/cotizador/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items, empresaId: clientMode === 'existing' ? selectedEmpresaId || null : null,
          dealId,
          recipientEmail, recipientName: recipientName || 'Cliente',
          notes, total: subtotal, discount, currency, validityDays, priceMode, ivaDiscriminado,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }
      if (dealId && !json.dealId) {
        toast('La cotización se guardó, pero no se pudo vincular a la oportunidad de origen', { icon: '⚠️' })
      }

      const quote: SavedQuote = {
        cotizacionId: json.cotizacionId,
        dealId:       json.dealId ?? null,
        ref:          json.ref,
        orgName:      json.orgName,
        primaryColor: json.primaryColor,
        logoUrl:      json.logoUrl,
        agentName:    json.agentName,
        recipientName: recipientName || 'Cliente',
        recipientEmail,
        empresaName:  selectedEmpresa?.name,
        cartItems:    [...cartItems],
        subtotal,
        discount:     json.discount,
        finalTotal:   json.finalTotal,
        ivaDiscriminado: json.ivaDiscriminado ?? ivaDiscriminado,
        totals:       json.totals ?? totals,
        currency,
        notes,
        validityDays: json.validityDays ?? validityDays,
        priceMode,
      }

      const doc     = await buildPdf(quote)
      const blobUrl = doc.output('bloburl') as unknown as string
      const dataUri = doc.output('datauristring') as unknown as string

      setSavedQuote(quote); setPdfBlobUrl(blobUrl); setPdfBase64(dataUri); setShowPreview(true)

      // Auto-agregar al Pipeline — antes había que confirmar "¿Agregar al
      // Pipeline?" con un botón; ahora pasa solo salvo que la cotización ya
      // venga vinculada a una oportunidad existente (dealId de la URL, ver
      // arriba). Se pasa `quote` directo, no se espera al re-render.
      if (!quote.dealId) addToPipeline(quote)
    } catch (err) {
      console.error(err); toast.error('Error al generar el presupuesto')
    } finally { setSaving(false) }
  }

  const downloadPdf = () => {
    if (!pdfBlobUrl || !savedQuote) return
    const a = document.createElement('a'); a.href = pdfBlobUrl; a.download = `${savedQuote.ref}.pdf`; a.click()
  }

  const sendByEmail = async () => {
    if (!savedQuote || !pdfBase64) return
    setSendingEmail(true)
    try {
      const res  = await fetch('/api/cotizador/enviar-mail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId: savedQuote.cotizacionId, pdfBase64 }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }
      toast.success(`Email enviado a ${savedQuote.recipientEmail}`)
    } catch { toast.error('Error de conexión') } finally { setSendingEmail(false) }
  }

  const buildWhatsApp = (quote?: SavedQuote) => {
    const src = quote ?? { recipientName: recipientName || '', cartItems, subtotal, finalTotal, discount, currency, notes: notes || '', ref: '', totals }
    const mode = quote?.priceMode ?? priceMode
    const tt = src.totals
    let t = `*Presupuesto de Servicios*`
    if ((src as any).ref) t += ` · ${(src as any).ref}`
    if (mode === 'GREMIO') t += ` · Precio Gremio`
    t += `\n\n`
    if (src.recipientName) t += `Hola ${src.recipientName},\n\nTe comparto el detalle:\n\n`
    src.cartItems.forEach(ci => {
      const lt = getPrice(ci, mode) * ci.quantity
      let l = `• ${ci.item.name}`
      if (ci.quantity > 1) l += ` ×${ci.quantity}`
      if (ci.type === 'SERVICE') {
        const bl = BILLING_LABELS[(ci.item as Service).billingCycle] ?? 'mes'
        l += ` — ${formatMoneyExact(lt, ci.item.currency)}/${bl}`
      } else {
        l += ` — ${formatMoneyExact(lt, ci.item.currency)} (${(ci.item as Product).unit})`
      }
      if (showArs && arsRate && ci.item.currency === 'USD') l += ` (${formatMoneyExact(lt * arsRate, 'ARS')})`
      t += l + '\n'
    })
    t += `\nSubtotal (neto): ${formatMoneyExact(tt.neto, src.currency)}`
    if (tt.descuentoMonto > 0) t += `\nDescuento (${tt.descuentoPct}%): -${formatMoneyExact(tt.descuentoMonto, src.currency)}`
    if (tt.discriminado && tt.iva.length > 0) {
      for (const b of tt.iva) t += `\nIVA ${String(b.pct).replace('.', ',')}%: ${formatMoneyExact(b.monto, src.currency)}`
    }
    t += `\n*Total${tt.discriminado ? ' (IVA incl.)' : ''}: ${formatMoneyExact(tt.total, src.currency)}*`
    if (showArs && arsRate && src.currency === 'USD') t += ` (ARS ${formatMoneyExact(tt.total * arsRate, 'ARS')})`
    if (src.notes) t += `\n\n📝 ${src.notes}`
    t += `\n\nCualquier consulta, estamos a disposición.`
    return `https://wa.me/?text=${encodeURIComponent(t)}`
  }

  // Recibe `quote` por parámetro (no lee `savedQuote` del closure) — se
  // dispara automáticamente desde handleSave() justo después de construir
  // el objeto, antes de que el setState del preview termine de aplicarse.
  const addToPipeline = async (quote: SavedQuote) => {
    setPipelineBusy(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       `${quote.empresaName ?? quote.recipientName} — ${quote.ref}`,
          amount:      quote.finalTotal,
          currency:    quote.currency,
          probability: 50, stage: 'PROPUESTA',
          notes:       `Generado automáticamente desde cotización ${quote.ref}`,
          empresaId:   clientMode === 'existing' ? selectedEmpresaId || null : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setPipelineState('error'); return }

      // Vincular estructuralmente la cotización al deal recién creado. Antes
      // no se chequeaba `.ok` acá — si este segundo pedido fallaba, el deal
      // igual quedaba creado y la UI mostraba "Se agregó automáticamente"
      // como si todo hubiera salido bien, pero Cotizacion.dealId quedaba
      // null (deal huérfano, sin forma de reintentar sólo el vínculo).
      const linkRes = await fetch(`/api/cotizaciones/${quote.cotizacionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: json.data.id }),
      })
      if (!linkRes.ok) {
        toast('Se creó la oportunidad en Pipeline, pero no se pudo vincular a esta cotización', { icon: '⚠️' })
      }

      setAutoDealId(json.data.id); setPipelineState('added')
    } catch { setPipelineState('error') } finally { setPipelineBusy(false) }
  }

  // "Deshacer" el auto-agregado. Borrar el deal en sí requiere ADMIN+
  // (DELETE /api/deals/[id]) — un SELLER (el rol principal que usa el
  // Cotizador) no puede. Si el borrado no está permitido, degrada a sólo
  // desvincular la cotización del deal (éste queda huérfano en Pipeline,
  // visible para un admin) en vez de fallar en silencio o romper.
  const removeFromPipeline = async () => {
    if (!autoDealId || !savedQuote) return
    setPipelineBusy(true)
    try {
      const del = await fetch(`/api/deals/${autoDealId}`, { method: 'DELETE' })
      await fetch(`/api/cotizaciones/${savedQuote.cotizacionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: null }),
      })
      setAutoDealId(null); setPipelineState('removed')
      if (!del.ok) toast('Se desvinculó, pero la oportunidad sigue en Pipeline — pedile a un admin que la borre', { icon: '⚠️' })
    } catch { toast.error('No se pudo quitar del Pipeline') } finally { setPipelineBusy(false) }
  }

  const reset = () => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    setSavedQuote(null); setPdfBlobUrl(null); setPdfBase64(null); setShowPreview(false)
    setCart({}); setManualEmail(''); setManualName(''); setNotes(''); setDiscount(0)
    setSelectedEmpresaId(''); setSelectedContactEmail(''); setSelectedContactName('')
    setManualContactInput(false); setPipelineState('idle'); setAutoDealId(null)
    setCurrentStep(1)
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  if (showPreview && savedQuote) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Vista previa del presupuesto</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {savedQuote.ref} · {savedQuote.recipientName} ·{' '}
              {savedQuote.discount > 0
                ? <><s className="opacity-60">{formatMoneyExact(savedQuote.subtotal, savedQuote.currency)}</s>{' '}<strong>{formatMoneyExact(savedQuote.finalTotal, savedQuote.currency)}</strong></>
                : formatMoneyExact(savedQuote.finalTotal, savedQuote.currency)
              }
              {savedQuote.empresaName && ` · ${savedQuote.empresaName}`}
            </p>
          </div>
          <button onClick={reset} className="p-2 rounded-lg hover:bg-[var(--color-surface-raised)]"
            style={{ color: 'var(--color-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)', height: '520px' }}>
          {pdfBlobUrl
            ? <iframe src={pdfBlobUrl} title="Vista previa" className="w-full h-full" style={{ border: 'none' }} />
            : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>Generando...</div>
          }
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { onClick: downloadPdf, bg: 'var(--color-primary)', icon: <Download size={18} className="text-white" />, label: 'Descargar Presupuesto', sub: `${savedQuote.ref}.pdf` },
            {
              onClick: sendByEmail,
              disabled: sendingEmail || !savedQuote.recipientEmail,
              bg: '#6366f1', icon: <Mail size={18} className="text-white" />,
              label: sendingEmail ? 'Enviando...' : 'Enviar por Mail',
              sub: savedQuote.recipientEmail ? 'Con PDF adjunto' : 'Sin mail cargado — usá WhatsApp',
            },
          ].map((btn, i) => (
            <button key={i} onClick={btn.onClick} disabled={(btn as any).disabled}
              className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 disabled:opacity-60"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: btn.bg }}>{btn.icon}</div>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{btn.label}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{btn.sub}</p>
              </div>
            </button>
          ))}
          <a href={buildWhatsApp(savedQuote)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[#25D366] hover:bg-[#25D366]/5"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#25D366' }}><MessageCircle size={18} className="text-white" /></div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Enviar por WhatsApp</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Con resumen y totales</p>
            </div>
          </a>
        </div>

        {savedQuote.dealId ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
            <CheckCircle size={15} /> Cotización vinculada a la oportunidad en Pipeline.
          </div>
        ) : pipelineState === 'added' ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
            <span className="flex items-center gap-2">
              <CheckCircle size={15} /> Se agregó automáticamente al Pipeline, etapa Propuesta.
            </span>
            <button onClick={removeFromPipeline} disabled={pipelineBusy}
              className="text-xs font-semibold shrink-0 hover:underline disabled:opacity-60" style={{ color: '#10b981' }}>
              {pipelineBusy ? 'Quitando...' : 'No agregar'}
            </button>
          </div>
        ) : pipelineState === 'removed' ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
            No se agregó al Pipeline.
          </div>
        ) : pipelineState === 'error' ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
            <span>No se pudo agregar automáticamente al Pipeline.</span>
            <button onClick={() => addToPipeline(savedQuote)} disabled={pipelineBusy}
              className="text-xs font-semibold shrink-0 hover:underline disabled:opacity-60">
              {pipelineBusy ? 'Reintentando...' : 'Reintentar'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
            <TrendingUp size={14} className="animate-pulse" /> Agregando al Pipeline...
          </div>
        )}

        <button onClick={reset} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>+ Nuevo presupuesto</button>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  const loadingCatalog = activeTab === 'SERVICE' ? loadingServices : loadingProducts
  const errorCatalog   = activeTab === 'SERVICE' ? errorServices   : errorProducts

  return (
    <div className="pb-44 lg:pb-32">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center"><Zap size={17} className="text-white" /></div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Cotizador</h1>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Armá un presupuesto mixto en segundos</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap shrink-0">
            {/* Toggle Público/Gremio — afecta sólo productos de catálogo con
                precioGremio cargado; Servicios y productos simples cotizan
                igual sin importar la posición. */}
            <div className="flex rounded-xl overflow-hidden p-0.5"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
              {([
                { mode: 'PUBLICO' as PriceMode, label: 'Público' },
                { mode: 'GREMIO' as PriceMode, label: 'Gremio' },
              ]).map(opt => (
                <button key={opt.mode} onClick={() => setPriceMode(opt.mode)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    priceMode === opt.mode ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

          {/* Dólar widget */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl shrink-0"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-1.5">
              <DollarSign size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>USD oficial</span>
            </div>
            {loadingRate ? (
              <span className="text-sm font-bold animate-pulse" style={{ color: 'var(--color-text-subtle)' }}>—</span>
            ) : arsRate ? (
              <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                ${arsRate.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>N/A</span>}
            <button onClick={() => refetchRate()} className="p-1 rounded-lg hover:bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-subtle)' }}>
              <RefreshCw size={12} />
            </button>
            {arsRate && (
              <button onClick={() => setShowArs(v => !v)}
                className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                style={showArs ? { background: 'var(--color-primary)', color: '#fff' } : { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                {showArs ? 'ARS ✓' : 'Ver ARS'}
              </button>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* ── Stepper ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6">
        {([
          { n: 1 as const, label: 'Ítems' },
          { n: 2 as const, label: 'Destinatario' },
          { n: 3 as const, label: 'Confirmar' },
        ]).map((s, i) => {
          const reached = s.n === 1 || (s.n === 2 && cartItems.length > 0) || (s.n === 3 && cartItems.length > 0 && !!recipientEmail)
          const active = currentStep === s.n
          return (
            <div key={s.n} className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => reached && setCurrentStep(s.n)}
                disabled={!reached}
                className="flex items-center gap-2 shrink-0 disabled:cursor-not-allowed"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  active ? 'gradient-bg text-white' : reached ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : ''
                }`} style={!active && !reached ? { background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-subtle)' } : undefined}>
                  {reached && !active && s.n < currentStep ? <CheckCircle size={13} /> : s.n}
                </span>
                <span className={`text-xs font-semibold hidden sm:inline ${active ? '' : 'opacity-60'}`} style={{ color: active ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                  {s.label}
                </span>
              </button>
              {i < 2 && <div className="h-px flex-1" style={{ background: 'var(--color-border)' }} />}
            </div>
          )
        })}
      </div>

      {/* ── STEP 1: Ítems ─────────────────────────────────────────────────── */}
      <section className="mb-5" hidden={currentStep !== 1}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center text-[10px] font-bold text-white shrink-0">1</span>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>Elegí los ítems</p>
        </div>

        {/* Tab selector */}
        <div className="flex rounded-xl overflow-hidden p-0.5 mb-3 w-fit"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          {([
            { type: 'SERVICE' as ItemType, label: 'Servicios', icon: <Wrench size={13} /> },
            { type: 'PRODUCT' as ItemType, label: 'Productos', icon: <Package size={13} /> },
          ]).map(tab => (
            <button key={tab.type} onClick={() => { setActiveTab(tab.type); setItemSearch('') }}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.type ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loadingCatalog ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: 'var(--color-surface)' }} />)}
          </div>
        ) : errorCatalog ? (
          <div className="rounded-2xl p-6 text-center flex flex-col items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-sm font-medium" style={{ color: '#ef4444' }}>
              No pudimos cargar {activeTab === 'SERVICE' ? 'los servicios' : 'los productos'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
            >
              Reintentar
            </button>
          </div>
        ) : showEmptyCatalogState ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <Wrench size={28} className="mx-auto mb-2" style={{ color: 'var(--color-text-subtle)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Sin servicios configurados</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Configurá en Configuración → Catálogo</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Buscador — filtra la grilla de abajo en vez de flotar un
                dropdown chiquito: en Productos, con miles de SKUs del
                proveedor, un listado completo con foto pide más lugar que
                10 líneas de texto. */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}>
              <Search size={14} style={{ color: 'var(--color-text-subtle)' }} />
              <input
                type="text"
                placeholder={`Buscar ${activeTab === 'SERVICE' ? 'servicio' : 'producto, SKU o marca'}...`}
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none"
                style={{ color: 'var(--color-text)' }}
              />
              {itemSearch && <button onClick={() => setItemSearch('')} style={{ color: 'var(--color-text-subtle)' }}><X size={13} /></button>}
            </div>

            {/* Filtro de categoría/subcategoría + marca — sólo Productos */}
            {activeTab === 'PRODUCT' && (productCategories.length > 0 || productBrands.length > 0) && (
              <CatalogFilters
                categories={productCategories}
                brands={productBrands}
                categoryId={productCategoryId}
                onCategoryChange={setProductCategoryId}
                brand={productBrand}
                onBrandChange={setProductBrand}
              />
            )}

            {/* Grilla de Servicios */}
            {activeTab === 'SERVICE' && (
              filteredServices.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Sin resultados para "{itemSearch}"</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredServices.map(s => {
                    const k = itemKey('SERVICE', s.id)
                    const inCart = cart[k]?.quantity ?? 0
                    const unitPrice = getUnitPrice('SERVICE', s, priceMode)
                    return (
                      <div key={k} className="surface rounded-2xl p-3 flex flex-col gap-2">
                        <div className="w-full aspect-[4/3] rounded-xl bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden p-4">
                          {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt="" className="max-w-full max-h-full object-contain opacity-90" />
                          ) : (
                            <Wrench size={22} className="opacity-30" style={{ color: 'var(--color-text-muted)' }} />
                          )}
                        </div>
                        <p className="text-xs font-medium leading-snug line-clamp-2 flex-1" style={{ color: 'var(--color-text)' }}>{s.name}</p>
                        <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                          {formatPrice(unitPrice, s.currency)}<span className="text-xs font-normal" style={{ color: 'var(--color-text-subtle)' }}>/{BILLING_LABELS[s.billingCycle] ?? 'mes'}</span>
                        </p>
                        <button onClick={() => addItem('SERVICE', s)}
                          className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold gradient-bg text-white">
                          <Plus size={12} /> {inCart > 0 ? `Agregado ×${inCart}` : 'Agregar'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* Grilla de Productos: primero los cargados a mano (pocos, sin
                paginar), después el catálogo del proveedor (paginado). */}
            {activeTab === 'PRODUCT' && (
              <>
                {filteredSimpleProducts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-subtle)' }}>Tus productos</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {filteredSimpleProducts.map(p => {
                        const k = itemKey('PRODUCT', p.id)
                        const inCart = cart[k]?.quantity ?? 0
                        const unitPrice = getUnitPrice('PRODUCT', p, priceMode)
                        const kitComps = p.isKit ? (p.kitComponents ?? []) : []
                        return (
                          <div key={k} className="surface rounded-2xl p-3 flex flex-col gap-2">
                            <div className="w-full aspect-[4/3] rounded-xl bg-[var(--color-surface-raised)] flex items-center justify-center relative">
                              {p.isKit
                                ? <Boxes size={22} className="opacity-40" style={{ color: 'var(--color-primary)' }} />
                                : <Package size={22} className="opacity-30" style={{ color: 'var(--color-text-muted)' }} />}
                              {p.isKit && (
                                <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md tracking-wide"
                                  style={{ background: 'var(--color-primary)', color: '#fff' }}>KIT</span>
                              )}
                            </div>
                            <p className="text-xs font-medium leading-snug line-clamp-2 flex-1" style={{ color: 'var(--color-text)' }}>{p.name}</p>
                            {kitComps.length > 0 && (
                              <p className="text-[10px] leading-tight line-clamp-2" style={{ color: 'var(--color-text-subtle)' }}>
                                Incluye: {kitComps.map(c => `${c.quantity}× ${c.component.name}`).join(', ')}
                              </p>
                            )}
                            <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                              {formatPrice(unitPrice, p.currency)}<span className="text-xs font-normal" style={{ color: 'var(--color-text-subtle)' }}>/{p.unit}</span>
                            </p>
                            <button onClick={() => addItem('PRODUCT', p)}
                              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold gradient-bg text-white">
                              <Plus size={12} /> {inCart > 0 ? `Agregado ×${inCart}` : 'Agregar'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  {filteredSimpleProducts.length > 0 && (
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-subtle)' }}>Catálogo del proveedor</p>
                  )}
                  {loadingCatalogGrid ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: 'var(--color-surface)' }} />)}
                    </div>
                  ) : catalogGridItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Boxes size={26} className="mb-2 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        No hay productos del catálogo que coincidan {itemSearch ? `con "${itemSearch}"` : 'con el filtro'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                        {catalogGridItems.map(p => {
                          const k = itemKey('PRODUCT', p.id)
                          const inCart = cart[k]?.quantity ?? 0
                          return (
                            <ProductCard
                              key={k}
                              product={p}
                              onClick={() => setDetailProduct(p)}
                              actionSlot={
                                <button onClick={(e) => { e.stopPropagation(); addItem('PRODUCT', p) }}
                                  className="mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold gradient-bg text-white">
                                  <ShoppingCart size={12} /> {inCart > 0 ? `Agregado ×${inCart}` : 'Agregar'}
                                </button>
                              }
                            />
                          )
                        })}
                      </div>
                      {catalogGridTotalPages > 1 && (
                        <Pagination page={productPage} totalPages={catalogGridTotalPages} total={catalogGridTotal} limit={PRODUCT_GRID_LIMIT} onPageChange={setProductPage} />
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Cart items */}
            <AnimatePresence>
              {cartItems.map(ci => {
                const k = itemKey(ci.type, ci.item.id)
                const isService = ci.type === 'SERVICE'
                const unitPrice = getPrice(ci, priceMode)
                const lineTotal = unitPrice * ci.quantity
                const per = isService
                  ? BILLING_LABELS[(ci.item as Service).billingCycle] ?? 'mes'
                  : (ci.item as Product).unit
                const priceLabel = `${formatPrice(lineTotal, ci.item.currency)}/${per}`
                return (
                  <motion.div key={k}
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: isService ? 'rgba(99,102,241,0.07)' : 'rgba(245,158,11,0.07)',
                             border: `1px solid ${isService ? 'rgba(99,102,241,0.25)' : 'rgba(245,158,11,0.3)'}` }}>
                    <div className="shrink-0">
                      {isService
                        ? <Wrench size={14} style={{ color: 'var(--color-primary)' }} />
                        : (ci.item as Product).isKit
                          ? <Boxes size={14} style={{ color: '#f59e0b' }} />
                          : <Package size={14} style={{ color: '#f59e0b' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                        {(ci.item as Product).isKit && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded tracking-wide shrink-0" style={{ background: '#f59e0b', color: '#fff' }}>KIT</span>
                        )}
                        <span className="truncate">{ci.item.name}</span>
                      </p>
                      {ci.type === 'PRODUCT' && (ci.item as Product).isKit && ((ci.item as Product).kitComponents?.length ?? 0) > 0 && (
                        <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--color-text-subtle)' }}>
                          Incluye: {(ci.item as Product).kitComponents!.map(c => `${c.quantity}× ${c.component.name}`).join(', ')}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] shrink-0" style={{ color: 'var(--color-text-subtle)' }}>Precio unit.</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={unitPrice}
                          onChange={e => setItemPrice(k, e.target.value)}
                          className="w-24 text-xs rounded border px-1.5 py-0.5 outline-none"
                          style={{ background: 'var(--color-surface)', border: `1px solid ${ci.priceOverride != null ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, color: 'var(--color-text)' }}
                        />
                        {ci.priceOverride != null && (
                          <button onClick={() => setItemPrice(k, '')} className="text-[10px] underline shrink-0" style={{ color: 'var(--color-text-subtle)' }}>
                            usar el de catálogo
                          </button>
                        )}
                        <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>· {priceLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => removeItem(k)}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90"
                        style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                        <Minus size={12} />
                      </button>
                      <input type="number" min="1" value={ci.quantity} onChange={e => setQty(k, parseInt(e.target.value))}
                        className="w-10 text-center text-sm font-bold rounded-lg border outline-none py-0.5"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }} />
                      <button onClick={() => addItem(ci.type, ci.item)}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 gradient-bg text-white">
                        <Plus size={12} />
                      </button>
                      <button onClick={() => setCart(p => { const n = { ...p }; delete n[k]; return n })}
                        className="ml-1 p-1 rounded transition-colors hover:text-red-400"
                        style={{ color: 'var(--color-text-subtle)' }}>
                        <X size={13} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Descuento (pantalla 3, junto con el resumen) ─────────────────── */}
      <section hidden={currentStep !== 3} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-subtle)' }}>%</span>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
              Descuento <span className="normal-case font-normal">(opcional)</span>
            </p>
          </div>
          <div className="rounded-2xl px-4 py-3 flex items-center gap-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3 flex-1">
              <Tag size={15} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="number" min="0" max="100" step="0.5"
                value={discount || ''}
                onChange={e => setDiscount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                placeholder="0"
                className="w-20 text-center text-lg font-bold rounded-xl border outline-none py-1.5 transition-all focus:ring-2 focus:ring-[var(--color-primary)]/30"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
              />
              <span className="text-lg font-bold" style={{ color: 'var(--color-text-muted)' }}>%</span>
            </div>
            {discount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-right">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Ahorro: <span className="font-semibold text-emerald-400">{formatMoneyExact(discountAmt, currency)}</span>
                </p>
                <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                  Total: {formatMoneyExact(finalTotal, currency)}
                </p>
              </motion.div>
            )}
          </div>
      </section>

      {/* ── IVA (pantalla 3) ──────────────────────────────────────────────── */}
      <section hidden={currentStep !== 3} className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-subtle)' }}>%</span>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>IVA</p>
        </div>
        <label className="rounded-2xl px-4 py-3 flex items-start gap-3 cursor-pointer"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <input type="checkbox" checked={ivaDiscriminado} onChange={e => setIvaDiscriminado(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-[var(--color-primary)]" />
          <span className="text-sm" style={{ color: 'var(--color-text)' }}>
            Discriminar IVA
            <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Los precios del catálogo son netos. Con esto, el presupuesto muestra el IVA por alícuota (21% / 10,5% según el producto) y el total lo incluye.
            </span>
          </span>
        </label>
      </section>

      {/* ── Validez (pantalla 3) ──────────────────────────────────────────── */}
      <section hidden={currentStep !== 3} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-subtle)' }}>
              <Clock size={11} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
              Validez de la cotización
            </p>
          </div>
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <input
              type="number" min="1" max="365" step="1"
              value={validityDays}
              onChange={e => { setValidityTouched(true); setValidityDays(Math.max(1, Math.min(365, Number(e.target.value) || 1))) }}
              className="w-20 text-center text-lg font-bold rounded-xl border outline-none py-1.5 transition-all focus:ring-2 focus:ring-[var(--color-primary)]/30"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
            />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              días — se verá como &quot;Válida por {validityDays} días&quot; en el presupuesto
            </span>
          </div>
      </section>

      {/* ── Resumen: ítems (marca · categoría) + Público vs Gremio de costado ── */}
      <section hidden={currentStep !== 3} className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-subtle)' }}>
            <FileText size={11} />
          </span>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>Resumen</p>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="grid sm:grid-cols-2">
            {/* Ítems: marca y categoría como subtítulo, más legible que el
                nombre completo (a veces con código de proveedor y largo) */}
            <div className="p-4 space-y-2.5 sm:border-r" style={{ borderColor: 'var(--color-border)' }}>
              {cartItems.map(ci => {
                const k = itemKey(ci.type, ci.item.id)
                const product = ci.type === 'PRODUCT' ? (ci.item as Product) : null
                const subtitle = product ? [product.brand, product.category?.name].filter(Boolean).join(' · ') : null
                return (
                  <div key={k} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate" style={{ color: 'var(--color-text)' }}>{ci.item.name}{ci.quantity > 1 && ` ×${ci.quantity}`}</p>
                      {subtitle && <p className="text-xs truncate" style={{ color: 'var(--color-text-subtle)' }}>{subtitle}</p>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Público vs Gremio de costado — sólo si realmente difieren */}
            <div className="p-4 flex flex-col justify-center gap-3">
              {hasGremioSavings ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className={priceMode === 'PUBLICO' ? 'opacity-100' : 'opacity-50'}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Público</p>
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{formatMoneyExact(subtotalPublico, currency)}</p>
                  </div>
                  <div className={priceMode === 'GREMIO' ? 'opacity-100' : 'opacity-50'}>
                    <p className="text-[10px] uppercase tracking-wide text-emerald-500">Gremio</p>
                    <p className="text-lg font-bold text-emerald-500">{formatMoneyExact(subtotalGremio, currency)}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Subtotal</p>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{formatMoneyExact(subtotal, currency)}</p>
                </div>
              )}
              <div className="pt-2 border-t space-y-0.5" style={{ borderColor: 'var(--color-border)' }}>
                {discount > 0 && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Descuento {discount}%: -{formatMoneyExact(totals.descuentoMonto, currency)}</p>
                )}
                {ivaDiscriminado && totals.iva.length > 0 && (
                  <>
                    {discount > 0 && <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Neto gravado: {formatMoneyExact(totals.netoGravado, currency)}</p>}
                    {totals.iva.map(b => (
                      <p key={b.pct} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        IVA {String(b.pct).replace('.', ',')}%: {formatMoneyExact(b.monto, currency)}
                      </p>
                    ))}
                  </>
                )}
                <p className="text-base font-bold pt-0.5" style={{ color: 'var(--color-text)' }}>
                  Total{ivaDiscriminado ? ' (IVA incl.)' : ''}: {formatMoneyExact(totals.total, currency)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STEP 2: Destinatario ──────────────────────────────────────────── */}
      <section className="mb-5" hidden={currentStep !== 2}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center text-[10px] font-bold text-white shrink-0">2</span>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>Destinatario</p>
        </div>
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex rounded-xl overflow-hidden border p-0.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
            {(['existing', 'manual'] as const).map(mode => (
              <button key={mode} onClick={() => { setClientMode(mode); setManualContactInput(false) }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${clientMode === mode ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
                {mode === 'existing' ? 'Empresa del CRM' : 'Email directo'}
              </button>
            ))}
          </div>

          {clientMode === 'existing' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}><User size={11} className="inline mr-1" />Buscar contacto (empresa o particular)</label>
                <Input
                  placeholder="Nombre del contacto…"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  leftIcon={<User size={14} />}
                />
                {contactSearch.trim().length >= 2 && (
                  <div className="mt-1.5 rounded-xl overflow-hidden border max-h-52 overflow-y-auto" style={{ borderColor: 'var(--color-border)' }}>
                    {contactSearchResults.length === 0 ? (
                      <div className="px-3 py-2 space-y-2">
                        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                          Sin resultados para &quot;{contactSearch}&quot;.
                        </p>
                        <button
                          onClick={() => { setShowNewContactForm(true); setNewContactFirstName(contactSearch.trim()) }}
                          className="text-xs font-semibold flex items-center gap-1"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          <UserPlus size={13} /> Cargar cliente nuevo
                        </button>
                      </div>
                    ) : (
                      contactSearchResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            if (!c.email) { setFixingContact({ id: c.id, firstName: c.firstName, lastName: c.lastName, empresaId: c.empresa?.id ?? null }); setFixEmailValue(''); return }
                            setSelectedContactEmail(c.email)
                            setSelectedContactName(`${c.firstName} ${c.lastName}`.trim())
                            setSelectedEmpresaId(c.empresa?.id ?? '')
                            setManualContactInput(false)
                            setContactSearch('')
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-raised)] transition-colors border-b last:border-0"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <span style={{ color: 'var(--color-text)' }}>{c.firstName} {c.lastName}</span>
                          <span className="block text-[11px]" style={{ color: c.email ? 'var(--color-text-subtle)' : '#f59e0b' }}>
                            {c.empresa?.name ?? 'Particular'} — {c.email ?? 'sin mail cargado, click para agregarlo'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {fixingContact && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-surface-raised)', border: '1px solid #f59e0b' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                      {fixingContact.firstName} {fixingContact.lastName} no tiene mail cargado
                    </p>
                    <button onClick={() => setFixingContact(null)} className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Cancelar</button>
                  </div>
                  <Input type="email" placeholder="email@cliente.com" value={fixEmailValue} onChange={e => setFixEmailValue(e.target.value)} />
                  <Button size="sm" className="w-full" onClick={handleSaveFixEmail} loading={savingFixEmail} disabled={!fixEmailValue.trim()}>
                    Guardar y usar como destinatario
                  </Button>
                </div>
              )}

              {showNewContactForm && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--color-text)' }}>
                      <UserPlus size={13} /> Cliente nuevo
                    </p>
                    <button onClick={() => setShowNewContactForm(false)} className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Cancelar</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Nombre" value={newContactFirstName} onChange={e => setNewContactFirstName(e.target.value)} />
                    <Input placeholder="Apellido" value={newContactLastName} onChange={e => setNewContactLastName(e.target.value)} />
                  </div>
                  <Input type="email" placeholder="email@cliente.com" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} />
                  <Input placeholder="Teléfono (opcional)" value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} />
                  <Button size="sm" className="w-full" onClick={handleCreateContact} loading={creatingContact}>
                    Cargar y usar como destinatario
                  </Button>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}><Building2 size={11} className="inline mr-1" />Empresa</label>
                <Select
                  options={[{ value: '', label: 'Seleccionar empresa...' }, ...empresas.map(e => ({ value: e.id, label: e.city ? `${e.name}  (${e.city})` : e.name }))]}
                  value={selectedEmpresaId}
                  onChange={e => { setSelectedEmpresaId(e.target.value); setSelectedContactEmail(''); setSelectedContactName(''); setManualContactInput(false); setManualEmail(''); setManualName('') }}
                />
              </div>
              {selectedEmpresaId && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}><User size={11} className="inline mr-1" />Contacto</label>
                  {contacts.length > 0 && !manualContactInput ? (
                    <Select
                      options={[
                        { value: '', label: 'Seleccionar contacto...' },
                        ...contacts.map(c => ({
                          value: c.id,
                          label: c.email ? `${c.firstName} ${c.lastName} — ${c.email}` : `${c.firstName} ${c.lastName} — sin mail, click para cargarlo`,
                        })),
                        { value: '__manual__', label: '— Ingresar otro email —' },
                      ]}
                      value=""
                      onChange={e => {
                        if (e.target.value === '__manual__') { setManualContactInput(true); setSelectedContactEmail(''); setSelectedContactName('') }
                        else {
                          const c = contacts.find(x => x.id === e.target.value)
                          if (!c) return
                          if (!c.email) { setFixingContact({ id: c.id, firstName: c.firstName, lastName: c.lastName, empresaId: selectedEmpresaId || null }); setFixEmailValue(''); return }
                          setSelectedContactEmail(c.email); setSelectedContactName(`${c.firstName} ${c.lastName}`.trim())
                        }
                      }}
                    />
                  ) : (
                    <div className="space-y-2">
                      {contacts.length > 0 && <button onClick={() => setManualContactInput(false)} className="text-xs" style={{ color: 'var(--color-primary)' }}>← Volver a los contactos</button>}
                      <Input placeholder="Nombre del contacto" value={manualName} onChange={e => setManualName(e.target.value)} leftIcon={<User size={14} />} />
                      <Input type="email" placeholder="email@empresa.com" value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Nombre del destinatario" value={manualName} onChange={e => setManualName(e.target.value)} leftIcon={<User size={14} />} />
              <Input type="email" placeholder="email@empresa.com" value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
            </div>
          )}

          {recipientEmail && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="text-xs font-medium" style={{ color: '#10b981' }}>
                {recipientName && `${recipientName} — `}{recipientEmail}
              </span>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── STEP 3: Notas ─────────────────────────────────────────────────── */}
      <section className="mb-5" hidden={currentStep !== 3}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-subtle)' }}>3</span>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
            Notas <span className="normal-case font-normal">(opcional)</span>
          </p>
        </div>
        <textarea
          className="w-full rounded-2xl px-4 py-3.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          rows={3}
          placeholder="Condiciones especiales, validez del presupuesto, próximos pasos..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </section>

      {/* ── Sticky bottom bar ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {cartItems.length > 0 && (
          <motion.div
            initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 border-t backdrop-blur-sm"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="max-w-2xl mx-auto px-4 py-3">
              {currentStep === 1 && (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{cartItems.length} ítem{cartItems.length !== 1 ? 's' : ''}</p>
                    {cartItems.map(ci => {
                      const k = itemKey(ci.type, ci.item.id)
                      return (
                        <span key={k} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                          {ci.type === 'SERVICE' ? <Wrench size={9} /> : <Package size={9} />}
                          {ci.item.name}{ci.quantity > 1 && ` ×${ci.quantity}`}
                        </span>
                      )
                    })}
                  </div>
                  <button onClick={clearCart} className="p-1.5 rounded-lg hover:text-red-400 hover:bg-red-500/10 transition-all"
                    style={{ color: 'var(--color-text-subtle)' }} title="Vaciar">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {discount > 0 && currentStep === 3 ? (
                    <>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Total final</p>
                      <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                        {formatPrice(finalTotal, currency)}
                        <span className="text-xs font-normal ml-1.5 text-emerald-400">-{discount}%</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Total</p>
                      <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{formatPrice(subtotal, currency)}</p>
                    </>
                  )}
                </div>
                <div className="flex gap-2 flex-1">
                  {currentStep > 1 && (
                    <Button variant="secondary" onClick={() => setCurrentStep(s => (s - 1) as 1 | 2)} leftIcon={<ChevronLeft size={15} />}>
                      Atrás
                    </Button>
                  )}
                  {currentStep === 1 && (
                    <Button className="flex-1" onClick={() => setCurrentStep(2)} rightIcon={<ChevronRight size={15} />}>
                      Siguiente: Destinatario
                    </Button>
                  )}
                  {currentStep === 2 && (
                    <Button className="flex-1" onClick={() => setCurrentStep(3)} disabled={!recipientName.trim()} rightIcon={<ChevronRight size={15} />}>
                      Siguiente: Confirmar
                    </Button>
                  )}
                  {currentStep === 3 && (
                    <>
                      <Button className="flex-1" onClick={handleSave} loading={saving} leftIcon={<Send size={15} />}>
                        Generar Presupuesto
                      </Button>
                      <a href={buildWhatsApp()} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-all whitespace-nowrap"
                        style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.2)' }}>
                        <MessageCircle size={15} />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {cartItems.length === 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 flex items-center gap-2 rounded-full px-4 py-2 text-xs pointer-events-none shadow-card"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          <ChevronRight size={12} style={{ color: 'var(--color-primary)' }} />
          Buscá un <span className="font-semibold mx-1" style={{ color: 'var(--color-primary)' }}>servicio o producto</span> para empezar
        </div>
      )}

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onAdd={(p) => { addItem('PRODUCT', p); setDetailProduct(null) }}
        addLabel="Agregar al presupuesto"
      />
    </div>
  )
}
