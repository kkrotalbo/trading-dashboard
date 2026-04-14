'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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
    case 'LONG_OPEN':  return { label: '▲ LONG Apertura',  text: 'text-green-400', border: 'border-green-500/40', bg: 'bg-green-500/10' }
    case 'LONG_CLOSE': return { label: '▲ LONG Cierre',    text: 'text-green-300', border: 'border-green-500/20', bg: 'bg-green-500/5'  }
    case 'SHORT_OPEN': return { label: '▼ SHORT Apertura', text: 'text-red-400',   border: 'border-red-500/40',   bg: 'bg-red-500/10'   }
    case 'SHORT_CLOSE':return { label: '▼ SHORT Cierre',   text: 'text-red-300',   border: 'border-red-500/20',   bg: 'bg-red-500/5'    }
    default:           return { label: op,                 text: 'text-gray-400',  border: 'border-gray-700',     bg: 'bg-gray-800'     }
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

// ── Subcomponentes ────────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, color = 'text-white' }: {
  title: string; value: string; subtitle?: string; color?: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{title}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
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
    <div className={`border rounded-lg px-4 py-3 flex items-center justify-between gap-4 ${style.border} ${style.bg}`}>
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
      <div className="px-6 py-16 text-center text-gray-600">
        Sin operaciones registradas aún.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
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
            const pnlColor = op.pnl_usdt === null ? 'text-gray-600' : pnl >= 0 ? 'text-green-400' : 'text-red-400'
            return (
              <tr key={op.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap tabular-nums">
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
                  {op.pnl_usdt !== null
                    ? `${pnl >= 0 ? '+' : ''}$${fmt(op.pnl_usdt)}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                  ${fmt(op.saldo_acumulado)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
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

export default function Dashboard() {
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
    // Carga inicial de datos
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

    // Suscripción en tiempo real
    const channel = supabase
      .channel('trading-signals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'eth_binance_trading_1h' },
        (payload) => {
          const newOp = payload.new as Operation
          setOperations(prev => [newOp, ...prev])
          addNotification(newOp)
          setError(null)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error')
          setError('Se perdió la conexión en tiempo real. Recarga la página para reconectar.')
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [addNotification])

  const stats = calcStats(operations)

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Trading Dashboard</h1>
            <p className="text-xs text-gray-500">ETH/USDT 1H — Paper Trading</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              realtimeStatus === 'connected' ? 'bg-green-400 animate-pulse' :
              realtimeStatus === 'error'     ? 'bg-red-400' :
                                               'bg-yellow-400 animate-pulse'
            }`} />
            <span className="text-xs text-gray-400">
              {realtimeStatus === 'connected' ? 'Tiempo real activo' :
               realtimeStatus === 'error'     ? 'Sin conexión' : 'Conectando...'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* Error */}
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {/* Notificaciones de señales */}
        {notifications.length > 0 && (
          <div className="space-y-2">
            {notifications.map(notif => (
              <NotificationCard
                key={notif.id}
                notif={notif}
                onClose={() => dismissNotification(notif.id)}
              />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Saldo actual"
            value={`$${fmt(stats.balance)}`}
          />
          <StatCard
            title="P&L Total"
            value={`${stats.pnl >= 0 ? '+' : ''}$${fmt(stats.pnl)}`}
            subtitle={`${stats.pnlPct >= 0 ? '+' : ''}${stats.pnlPct.toFixed(2)}% vs capital`}
            color={stats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}
          />
          <StatCard
            title="Operaciones"
            value={stats.totalOps.toString()}
            subtitle="cerradas"
          />
          <StatCard
            title="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            color={stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}
          />
        </div>

        {/* Tabla de operaciones */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-200">Historial de operaciones</h2>
            <span className="text-xs text-gray-600">{operations.length} registros</span>
          </div>
          {loading
            ? <div className="px-6 py-16 text-center text-gray-600">Cargando...</div>
            : <OperationsTable ops={operations} />
          }
        </div>

      </main>
    </div>
  )
}
