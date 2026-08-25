'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, LogOut, Clock, CheckCircle, AlertCircle, Calendar, AlertTriangle, Plus, Home, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import type { Asistencia } from '@/types'
import { argentinaDayKey } from '@/lib/timezone'
import { MODALIDADES_FICHAJE, findOpenBlockClient, fetchTurnosParaFichaje } from '@/lib/asistencia-turnos'
import { invalidateFichaje } from '@/lib/asistencia-query-keys'
import { getPositionSafe } from '@/lib/geolocation'
import toast from 'react-hot-toast'

function formatHora(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function horasTrabajadas(entrada: string | null, salida: string | null): string {
  if (!entrada || !salida) return '—'
  const ms = new Date(salida).getTime() - new Date(entrada).getTime()
  const h  = Math.floor(ms / 3_600_000)
  const m  = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

function mesActual() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Mismo cálculo que RRHH (rrhh/page.tsx) — antes acá el % se calculaba
// sobre presentes+ausentes, así que un día sin fichar y sin marcar ausente
// no restaba nada y el empleado veía un % más alto que el que ve RRHH de
// esa misma persona en el mismo mes. Ahora ambas pantallas usan el mismo
// denominador (días hábiles transcurridos del mes).
function weekdaysElapsed(mes: string): number {
  const [y, m] = mes.split('-').map(Number)
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd   = new Date(y, m, 0)
  const today      = new Date()
  const end        = today < monthEnd ? today : monthEnd
  let count = 0
  for (const d = new Date(monthStart); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

export default function MiAsistenciaPage() {
  const { user } = useAuthStore()
  const qc   = useQueryClient()
  const [now, setNow] = useState(new Date())
  const [checkingIn,  setCheckingIn]  = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [modalidad,   setModalidad]   = useState(MODALIDADES_FICHAJE[0])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // argentinaDayKey, no toISOString (siempre UTC) — a la noche ya caía en
  // el día siguiente y esta pantalla dejaba de reconocer el fichaje de hoy
  // como propio. Ver src/lib/timezone.ts.
  const hoy      = argentinaDayKey(now)
  const horaStr  = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const fechaStr = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const { data: historialData, isLoading, isError } = useQuery({
    queryKey: ['mi-asistencia', mesActual(), user?.id],
    queryFn:  async () => {
      const r = await fetch(`/api/asistencia?mes=${mesActual()}&userId=${user?.id}`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Asistencia[]
    },
    staleTime: 30_000,
    enabled:   !!user?.id,
  })

  const historial = historialData ?? []
  const hoyRecord = historial.find(r => r.fecha.slice(0, 10) === hoy)

  const hasEntrada = !!hoyRecord?.horaEntrada
  const esTardanza = hoyRecord?.tardanza
  const esAusente  = hoyRecord?.ausente

  // Bloques del mes — sin esto, una vez que el principal cerraba
  // (hoyRecord.horaSalida ya seteado) no había forma de fichar/cerrar un
  // segundo turno el mismo día. `openBlock` manda por sobre el mirror de
  // Asistencia para decidir si hay que mostrar "Registrar Salida".
  //
  // Bug real de producción (reportado 22/08 — esta misma pantalla):
  // filtraba a "sólo los de HOY" antes de buscar el abierto — un bloque
  // abierto un día anterior (alguien que se olvidó de fichar salida) se
  // volvía invisible acá, la pantalla decía "no fichaste entrada" y sólo
  // ofrecía "Registrar Entrada" de nuevo — pero el servidor lo rechazaba
  // con 409 "ya tenés una entrada sin cerrar" porque SÍ ve ese bloque
  // (findOpenBlock, sin filtro de día, a propósito). La persona quedaba
  // sin ninguna acción posible para fichar. Ver findOpenBlockClient en
  // asistencia-turnos.ts. queryKey sigue llamándose 'turnos-hoy' — la
  // comparten el resto de las pantallas de fichaje, no vale tocarla.
  // fetchTurnosParaFichaje trae el mes actual + el anterior — cubre el
  // caso límite de un bloque abierto que quedó del otro lado de un cambio
  // de mes.
  const { data: turnosMes, refetch: refetchTurnos } = useQuery({
    queryKey: ['turnos-hoy', user?.id],
    queryFn: () => user?.id ? fetchTurnosParaFichaje(user.id, mesActual()) : Promise.resolve([]),
    staleTime: 30_000,
    enabled: !!user?.id,
  })
  const openBlock = findOpenBlockClient(turnosMes ?? [])

  // Bug real de producción (reportado por un técnico — Gabriel Guias,
  // 24/08): esta pantalla decidía qué tarjeta mostrar mirando primero
  // `hasEntrada`, que sólo mira el registro de HOY (`hoyRecord`). Cerrar un
  // bloque abierto de un día ANTERIOR (el fix de más arriba) actualiza el
  // mirror de ESE día, no el de hoy — así que apenas cerraba su bloque
  // viejo, esta pantalla seguía sin ver ninguna entrada "de hoy" y volvía a
  // mostrar "Registrar Entrada" como si nada hubiera pasado. La persona,
  // viendo eso, tocaba "Registrar Entrada" de nuevo — creando un turno
  // nuevo, real, de apenas unos minutos, marcado con tardanza, que nunca
  // debió existir. Las otras 3 pantallas de fichaje (attendance-widget,
  // mi-dia, mobile-quick-bar) ya miran `openBlock` ANTES que el estado de
  // "hoy" — acá se ordena igual más abajo: `openBlock` decide antes que
  // `hasEntrada` si hay que ofrecer Salida o Entrada, sin importar qué
  // diga `hoyRecord`.

  // Bug real encontrado en auditoría: `hasEntrada` depende de
  // `historialData` (query `mi-asistencia`) y `openBlock` depende de
  // `turnosMes` (query independiente) — si una resuelve antes que la
  // otra, podía mostrarse un estado incoherente (ej. el flujo de
  // "Registrar Entrada" con selector de modalidad mientras `openBlock` ya
  // señalaba un turno abierto de verdad). Se espera a que las dos
  // resuelvan antes de decidir qué tarjeta mostrar.
  const stillLoadingAsistencia = historialData === undefined || turnosMes === undefined

  const refreshAsistencia = () => {
    // Bug real encontrado en auditoría: antes esto sólo invalidaba la
    // query propia de esta pantalla — el pill del widget del header
    // (montado permanentemente en el layout) quedaba desactualizado hasta
    // que venciera su staleTime de 30s.
    invalidateFichaje(qc)
    refetchTurnos()
  }

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const pos  = await getPositionSafe()
      const res  = await fetch('/api/asistencia/check-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modalidad, lat: pos?.lat, lng: pos?.lng }),
      })
      const json = await res.json()
      if (res.status === 409) { toast.error(json.error); refreshAsistencia(); return }
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(json.tardanza ? '⚠️ Entrada registrada con tardanza' : json.esPrincipal ? '✅ ¡Buenos días! Entrada registrada' : '✅ Turno adicional registrado')
      refreshAsistencia()
    } catch { toast.error('Error de conexión') }
    finally { setCheckingIn(false) }
  }

  const handleCheckOut = async () => {
    setCheckingOut(true)
    try {
      const pos  = await getPositionSafe()
      const res  = await fetch('/api/asistencia/check-out', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos?.lat, lng: pos?.lng }),
      })
      const json = await res.json()
      // check-out/route.ts nunca devuelve 409 (sólo 400) — ver mismo
      // comentario en attendance-widget.tsx/mi-dia/page.tsx.
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(`Hasta luego! Trabajaste ${json.horasTrabajadas}`)
      refreshAsistencia()
    } catch { toast.error('Error de conexión') }
    finally { setCheckingOut(false) }
  }

  // Stats del mes
  const presentes  = historial.filter(r => r.horaEntrada && !r.ausente).length
  const ausentes   = historial.filter(r => r.ausente).length
  const tardanzas  = historial.filter(r => r.tardanza).length
  const diasHabiles = weekdaysElapsed(mesActual())
  const pctPresent = diasHabiles > 0 ? Math.round((presentes / diasHabiles) * 100) : 0

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Mi Asistencia</h1>
        <p className="text-sm capitalize mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{fechaStr}</p>
      </div>

      {/* Check-in card */}
      <div className="rounded-2xl p-6 text-center relative overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {/* Reloj */}
        <p className="text-5xl font-bold tabular-nums mb-1" style={{ color: 'var(--color-text)' }}>{horaStr}</p>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>{fechaStr}</p>

        {/* Estado hoy */}
        <AnimatePresence mode="wait">
          {stillLoadingAsistencia ? (
            <motion.div key="cargando" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="h-10 flex items-center justify-center">
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Cargando...</span>
            </motion.div>
          ) : esAusente ? (
            <motion.div key="ausente" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              <AlertCircle size={15} /> Marcado como ausente
            </motion.div>
          ) : (!openBlock && !hasEntrada) ? (
            <motion.div key="noEntrada" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No registraste entrada hoy</p>
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border-strong)' }}>
                {MODALIDADES_FICHAJE.map(m => (
                  <button key={m} onClick={() => setModalidad(m)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all"
                    style={modalidad === m ? { background: 'var(--color-primary)', color: '#fff' } : { background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                    {m === 'Presencial' ? <Home size={12} /> : <Briefcase size={12} />}{m}
                  </button>
                ))}
              </div>
              <Button size="lg" leftIcon={<LogIn size={18} />} onClick={handleCheckIn} loading={checkingIn}
                className="px-8">
                Registrar Entrada
              </Button>
            </motion.div>
          ) : openBlock ? (
            <motion.div key="sinSalida" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1.5">
                  <LogIn size={13} /> Entrada: <strong style={{ color: 'var(--color-text)' }}>{formatHora(openBlock?.horaEntrada ?? hoyRecord?.horaEntrada ?? null)}</strong>
                </span>
                {openBlock && !openBlock.esPrincipal && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)' }}>
                    Turno adicional
                  </span>
                )}
                {openBlock?.esPrincipal && esTardanza && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    Tardanza
                  </span>
                )}
              </div>
              <Button size="lg" variant="outline" leftIcon={<LogOut size={18} />} onClick={handleCheckOut} loading={checkingOut}
                className="px-8">
                Registrar Salida
              </Button>
            </motion.div>
          ) : (
            <motion.div key="completo" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle size={24} style={{ color: '#10b981' }} />
              </div>
              <p className="font-semibold" style={{ color: '#10b981' }}>¡Jornada registrada!</p>
              <div className="flex gap-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1.5"><LogIn size={13} /> {formatHora(hoyRecord?.horaEntrada ?? null)}</span>
                <span className="flex items-center gap-1.5"><LogOut size={13} /> {formatHora(hoyRecord?.horaSalida ?? null)}</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={13} /> {horasTrabajadas(hoyRecord?.horaEntrada ?? null, hoyRecord?.horaSalida ?? null)}
                </span>
              </div>
              {esTardanza && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                  Tardanza registrada
                </span>
              )}
              {/* Turno adicional/extra el mismo día — antes era imposible
                  (el check-in tiraba 409 apenas había una entrada de hoy).
                  El server ya sabe que esto es un extra. */}
              <button onClick={handleCheckIn} disabled={checkingIn}
                className="flex items-center gap-1.5 text-xs font-medium mt-1 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                <Plus size={12} /> {checkingIn ? 'Guardando...' : 'Registrar turno adicional'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats mes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Presentes',   value: presentes,  color: '#10b981' },
          { label: 'Ausentes',    value: ausentes,   color: '#ef4444' },
          { label: 'Tardanzas',   value: tardanzas,  color: '#f59e0b' },
          { label: 'Presentismo', value: `${pctPresent}%`, color: 'var(--color-primary)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertTriangle size={16} />
          Error al cargar los datos. Intentá de nuevo.
        </div>
      )}

      {/* Historial */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Calendar size={16} /> Historial del mes
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
            ))}
          </div>
        ) : historial.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Sin registros este mes</p>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--color-text-muted)' }}>Fecha</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--color-text-muted)' }}>Entrada</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--color-text-muted)' }}>Salida</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Horas</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--color-text-muted)' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {[...historial].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(r => {
                  const isHoy = r.fecha.slice(0, 10) === hoy
                  return (
                    <tr key={r.id}
                      className={`transition-colors hover:bg-[var(--color-surface-raised)] ${isHoy ? 'bg-[var(--color-primary)]/5' : ''}`}
                      style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
                        {formatFecha(r.fecha)}
                        {isHoy && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-primary)', color: '#fff' }}>Hoy</span>}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>{formatHora(r.horaEntrada)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>{formatHora(r.horaSalida)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                        {horasTrabajadas(r.horaEntrada, r.horaSalida)}
                      </td>
                      <td className="px-4 py-3">
                        {r.ausente ? (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Ausente</span>
                        ) : r.tardanza ? (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Tardanza</span>
                        ) : r.horaEntrada ? (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Presente</span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>—</span>
                        )}
                        {r.observaciones && (
                          <span className="ml-1.5 text-[10px]" style={{ color: 'var(--color-text-subtle)' }} title={r.observaciones}>📝</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
