'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Operation, SignalNotification } from '@/types/trading'

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(val: number | string | null | undefined): number {
  return Number(val ?? 0)
}

function fmt(val: number | string | null, decimals = 2): string {
  return n(val).toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function opStyle(op: string) {
  switch (op) {
    case 'LONG_OPEN':  return { label: '▲ LONG Apertura',  text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' }
    case 'LONG_CLOSE': return { label: '▲ LONG Cierre',    text: 'text-emerald-300', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5'  }
    case 'SHORT_OPEN': return { label: '▼ SHORT Apertura', text: 'text-purple-400',  border: 'border-purple-500/40',  bg: 'bg-purple-500/10'  }
    case 'SHORT_CLOSE':return { label: '▼ SHORT Cierre',   text: 'text-purple-300',  border: 'border-purple-500/20',  bg: 'bg-purple-500/5'   }
    default:           return { label: op,                 text: 'text-gray-400',    border: 'border-gray-700',       bg: 'bg-gray-800'       }
  }
}

function calcStats(ops: Operation[]) {
  const closes = ops.filter(o => o.pnl_usdt !== null)
  const winners = closes.filter(o => n(o.pnl_usdt) > 0)
  const totalPnl = closes.reduce((sum, o) => sum + n(o.pnl_usdt), 0)
  const balance = ops.length ? n(ops[0].saldo_acumulado) : 1000
  return {
    balance,
    pnl: totalPnl,
    pnlPct: (totalPnl / 1000) * 100,
    totalOps: closes.length,
    winRate: closes.length ? (winners.length / closes.length) * 100 : 0,
  }
}

function getPieData(ops: Operation[]) {
  if (!ops.length) return { usdtPct: 100, ethPct: 0, usdtAmt: 1000, ethAmt: 0 }
  const latest = ops[0]
  const isOpen = latest.operacion.endsWith('_OPEN')
  if (isOpen) {
    const available = n(latest.saldo_acumulado)
    const inPosition = n(latest.monto_operacion)
    const total = available + inPosition
    return {
      usdtPct: (available / total) * 100,
      ethPct: (inPosition / total) * 100,
      usdtAmt: available,
      ethAmt: inPosition,
    }
  }
  return { usdtPct: 100, ethPct: 0, usdtAmt: n(latest.saldo_acumulado), ethAmt: 0 }
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function PieChart({ usdtPct, ethPct }: { usdtPct: number; ethPct: number }) {
  const displayEth = Math.round(ethPct)
  const displayUsdt = 100 - displayEth
  return (
    <div className="flex flex-col items-center justify-center gap-5">
      <div className="relative">
        <div
          className="w-40 h-40 rounded-full"
          style={{
            background: ethPct > 0
              ? `conic-gradient(#10b981 0% ${displayUsdt}%, #a855f7 ${displayUsdt}% 100%)`
              : 'conic-gradient(#10b981 0% 100%)',
            boxShadow: '0 0 40px rgba(16,185,129,0.25), 0 0 80px rgba(168,85,247,0.15)',
          }}
        />
        <div className="absolute inset-4 rounded-full bg-black flex flex-col items-center justify-center">
          {ethPct > 0 ? (
            <>
              <span className="text-purple-400 font-bold text-xl">{displayEth}%</span>
              <span className="text-gray-500 text-xs">en posición</span>
            </>
          ) : (
            <>
              <span className="text-emerald-400 font-bold text-xl">100%</span>
              <span className="text-gray-500 text-xs">USDT</span>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-5 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
          <span className="text-gray-400">USDT <span className="text-white font-semibold">{displayUsdt}%</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50" />
          <span className="text-gray-400">Posición <span className="text-white font-semibold">{displayEth}%</span></span>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="text-red-400 mt-0.5">⚠</span>
        <p className="text-red-400 text-sm">{message}</p>
      </div>
      <button onClick={onClose} className="text-red-400 hover:text-red-300 shrink-0">✕</button>
    </div>
  )
}

function NotificationCard({ notif, onClose }: { notif: SignalNotification; onClose: () => void }) {
  const style = opStyle(notif.operation.operacion)
  const isOpen = notif.operation.operacion.endsWith('_OPEN')
  return (
    <div className={`border rounded-xl px-4 py-3 flex items-center justify-between gap-4 backdrop-blur-sm ${style.border} ${style.bg}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{isOpen ? '🔔' : '✅'}</span>
        <div>
          <p className={`font-semibold ${style.text}`}>{style.label}</p>
          <p className="text-sm text-gray-400">
            {notif.operation.par} @ ${fmt(notif.operation.precio)}
            {notif.operation.rsi !== null && ` · RSI: ${n(notif.operation.rsi).toFixed(1)}`}
            {notif.operation.pnl_usdt !== null &&
              ` · P&L: ${n(notif.operation.pnl_usdt) >= 0 ? '+' : ''}$${fmt(notif.operation.pnl_usdt)}`}
            {notif.operation.razon && ` · ${notif.operation.razon}`}
          </p>
        </div>
      </div>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-300 shrink-0">✕</button>
    </div>
  )
}

function OperationsTable({ ops }: { ops: Operation[] }) {
  if (ops.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-gray-600 text-sm">
        Sin operaciones registradas aún.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
            <th className="text-left px-4 py-3">Fecha</th>
            <th className="text-left px-4 py-3">Operación</th>
            <th className="text-right px-4 py-3">Precio</th>
            <th className="text-right px-4 py-3">RSI</th>
            <th className="text-right px-4 py-3">P&amp;L</th>
            <th className="text-right px-4 py-3">Saldo</th>
            <th className="text-left px-4 py-3">Razón</th>
          </tr>
        </thead>
        <tbody>
          {ops.map((op) => {
            const style = opStyle(op.operacion)
            const pnl = n(op.pnl_usdt)
            const pnlColor = op.pnl_usdt === null ? 'text-gray-600' : pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
            return (
              <tr key={op.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap tabular-nums text-xs">
                  {new Date(op.fecha).toLocaleString('es-CL', {
                    timeZone: 'America/Santiago',
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className={`px-4 py-3 font-medium whitespace-nowrap ${style.text}`}>
                  {style.label}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                  ${fmt(op.precio)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-400">
                  {op.rsi !== null ? n(op.rsi).toFixed(1) : '—'}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-medium ${pnlColor}`}>
                  {op.pnl_usdt !== null ? `${pnl >= 0 ? '+' : ''}$${fmt(op.pnl_usdt)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                  ${fmt(op.saldo_acumulado)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">
                  {op.razon || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────

export default function Dashboard({ supabaseUrl, supabaseKey }: { supabaseUrl: string; supabaseKey: string }) {
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey])

  const [operations, setOperations] = useState<Operation[]>([])
  const [notifications, setNotifications] = useState<SignalNotification[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  const dismissNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const addNotification = useCallback((op: Operation) => {
    const id = Date.now()
    setNotifications(prev => [{ id, operation: op }, ...prev].slice(0, 5))
    setTimeout(() => dismissNotification(id), 30000)
  }, [dismissNotification])

  useEffect(() => {
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from('eth_binance_trading_1h')
          .select('*')
          .order('id', { ascending: false })
          .limit(200)
        if (error) throw error
        setOperations(data ?? [])
        setError(null)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        setError(`Error al cargar datos: ${msg}`)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    const channel = supabase
      .channel('trading-signals')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eth_binance_trading_1h' },
        (payload) => {
          const newOp = payload.new as Operation
          setOperations(prev => [newOp, ...prev])
          addNotification(newOp)
          setError(null)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error')
          setError('Se perdió la conexión en tiempo real. Recarga la página para reconectar.')
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [supabase, addNotification])

  const stats = calcStats(operations)
  const pie = getPieData(operations)

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">

      {/* Gradient blobs de fondo */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[700px] h-[700px] bg-emerald-500/10 rounded-full blur-[140px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-[140px] translate-x-1/2 translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/10 px-6 py-4 backdrop-blur-sm bg-black/40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 via-white to-purple-400 bg-clip-text text-transparent">
              Trading Dashboard
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">ETH/USDT 1H — Paper Trading</p>
          </div>
          <div className={`flex items-center gap-2 border rounded-full px-3 py-1.5 text-xs backdrop-blur-sm ${
            realtimeStatus === 'connected' ? 'border-emerald-500/30 bg-emerald-500/10' :
            realtimeStatus === 'error'     ? 'border-red-500/30 bg-red-500/10' :
                                             'border-yellow-500/30 bg-yellow-500/10'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              realtimeStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
              realtimeStatus === 'error'     ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
            }`} />
            <span className={
              realtimeStatus === 'connected' ? 'text-emerald-400' :
              realtimeStatus === 'error'     ? 'text-red-400' : 'text-yellow-400'
            }>
              {realtimeStatus === 'connected' ? 'En vivo' :
               realtimeStatus === 'error'     ? 'Sin conexión' : 'Conectando...'}
            </span>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* Error */}
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {/* Notificaciones */}
        {notifications.length > 0 && (
          <div className="space-y-2">
            {notifications.map(notif => (
              <NotificationCard key={notif.id} notif={notif} onClose={() => dismissNotification(notif.id)} />
            ))}
          </div>
        )}

        {/* Stats + Pie */}
        <div
          className="border border-white/10 rounded-2xl p-6 backdrop-blur-sm bg-white/5"
          style={{ boxShadow: '0 0 60px rgba(16,185,129,0.05), 0 0 100px rgba(168,85,247,0.05)' }}
        >
          <div className="flex flex-col md:flex-row gap-8">

            {/* Stats */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
                Resumen de cuenta
              </p>
              <div>
                <StatRow label="Capital inicial"       value="$1,000.00" />
                <StatRow
                  label="Saldo actual"
                  value={`$${fmt(stats.balance)}`}
                  color={stats.balance >= 1000 ? 'text-emerald-400' : 'text-red-400'}
                />
                <StatRow
                  label="P&L Total"
                  value={`${stats.pnl >= 0 ? '+' : ''}$${fmt(stats.pnl)} (${stats.pnlPct >= 0 ? '+' : ''}${stats.pnlPct.toFixed(2)}%)`}
                  color={stats.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
                />
                <StatRow label="Operaciones cerradas"  value={stats.totalOps.toString()} />
                <StatRow
                  label="Win Rate"
                  value={`${stats.winRate.toFixed(1)}%`}
                  color={stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}
                />
                <StatRow label="USDT disponible" value={`$${fmt(pie.usdtAmt)}`} color="text-emerald-400" />
                {pie.ethAmt > 0 && (
                  <StatRow label="En posición" value={`$${fmt(pie.ethAmt)}`} color="text-purple-400" />
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            <div className="md:hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Pie */}
            <div className="flex items-center justify-center md:w-64">
              <PieChart usdtPct={pie.usdtPct} ethPct={pie.ethPct} />
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div
          className="border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm bg-white/5"
          style={{ boxShadow: '0 0 60px rgba(16,185,129,0.03), 0 0 100px rgba(168,85,247,0.03)' }}
        >
          <div
            className="px-6 py-4 border-b border-white/10 flex items-center justify-between"
            style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.07) 0%, rgba(168,85,247,0.07) 100%)' }}
          >
            <h2 className="font-semibold text-gray-200">Historial de operaciones</h2>
            <span className="text-xs text-gray-500 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              {operations.length} registros
            </span>
          </div>
          {loading ? (
            <div className="px-6 py-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-3" />
              <p className="text-gray-600 text-sm">Cargando datos...</p>
            </div>
          ) : (
            <OperationsTable ops={operations} />
          )}
        </div>

      </main>
    </div>
  )
}
