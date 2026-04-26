'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
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
    case 'LONG_OPEN':  return { label: '▲ LONG Apertura',  color: '#34d399' }
    case 'LONG_CLOSE': return { label: '▲ LONG Cierre',    color: '#6ee7b7' }
    case 'SHORT_OPEN': return { label: '▼ SHORT Apertura', color: '#c084fc' }
    case 'SHORT_CLOSE':return { label: '▼ SHORT Cierre',   color: '#d8b4fe' }
    default:           return { label: op,                 color: '#9ca3af' }
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
  const usdt = Math.round(usdtPct)
  const eth = 100 - usdt
  const conicGradient = eth > 0
    ? `conic-gradient(#10b981 0% ${usdt}%, #a855f7 ${usdt}% 100%)`
    : `conic-gradient(#10b981 0% 100%)`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <div style={{ position: 'relative', width: '160px', height: '160px' }}>
        <div style={{ width: '160px', height: '160px', borderRadius: '50%', background: conicGradient, boxShadow: '0 0 40px rgba(16,185,129,0.3), 0 0 80px rgba(168,85,247,0.2)' }} />
        <div style={{ position: 'absolute', top: '20px', left: '20px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {eth > 0 ? (
            <>
              <span style={{ color: '#c084fc', fontWeight: 700, fontSize: '22px' }}>{eth}%</span>
              <span style={{ color: '#6b7280', fontSize: '11px' }}>en posición</span>
            </>
          ) : (
            <>
              <span style={{ color: '#34d399', fontWeight: 700, fontSize: '22px' }}>100%</span>
              <span style={{ color: '#6b7280', fontSize: '11px' }}>USDT</span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ color: '#9ca3af' }}>USDT <strong style={{ color: '#fff' }}>{usdt}%</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#a855f7', display: 'inline-block', boxShadow: '0 0 8px #a855f7' }} />
          <span style={{ color: '#9ca3af' }}>Posición <strong style={{ color: '#fff' }}>{eth}%</strong></span>
        </div>
      </div>
    </div>
  )
}

function CapitalChart({ ops }: { ops: Operation[] }) {
  const closes = [...ops].filter(o => o.pnl_usdt !== null).reverse()

  const W = 300
  const H = 190
  const pad = { top: 18, right: 18, bottom: 28, left: 52 }
  const cW = W - pad.left - pad.right
  const cH = H - pad.top - pad.bottom

  const dataPoints = [
    { x: 0, y: 1000 },
    ...closes.map((op, i) => ({ x: i + 1, y: n(op.saldo_acumulado) })),
  ]

  if (dataPoints.length < 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: `${W}px`, height: `${H}px`, gap: '8px' }}>
        <span style={{ color: '#4b5563', fontSize: '28px' }}>📈</span>
        <span style={{ color: '#4b5563', fontSize: '12px' }}>Sin operaciones aún</span>
      </div>
    )
  }

  const maxX = dataPoints.length - 1
  const vals = dataPoints.map(p => p.y)
  const minY = Math.min(...vals)
  const maxY = Math.max(...vals)
  const rangeY = maxY - minY || 100

  const sx = (x: number) => pad.left + (x / maxX) * cW
  const sy = (y: number) => pad.top + (1 - (y - minY) / rangeY) * cH

  const pts = dataPoints.map(p => `${sx(p.x)},${sy(p.y)}`).join(' L ')
  const linePath = `M ${pts}`
  const areaPath = `M ${sx(0)},${sy(dataPoints[0].y)} L ${pts} L ${sx(maxX)},${H - pad.bottom} L ${sx(0)},${H - pad.bottom} Z`

  const last = dataPoints[dataPoints.length - 1].y
  const positive = last >= 1000
  const lineColor = positive ? '#00f5ff' : '#ff2d7a'
  const glowId = 'cpGlow'
  const gradId = 'cpArea'

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => minY + r * rangeY)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Y-axis grid + labels */}
        {yTicks.map((yVal, i) => (
          <g key={i}>
            <line x1={pad.left} y1={sy(yVal)} x2={W - pad.right} y2={sy(yVal)}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,4" />
            <text x={pad.left - 6} y={sy(yVal) + 4} fill="#4b5563" fontSize="9" textAnchor="end"
              fontFamily="system-ui,sans-serif">
              ${Math.round(yVal)}
            </text>
          </g>
        ))}

        {/* Baseline $1000 */}
        {minY < 1000 && maxY > 1000 && (
          <line x1={pad.left} y1={sy(1000)} x2={W - pad.right} y2={sy(1000)}
            stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="5,3" />
        )}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Neon line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5"
          filter={`url(#${glowId})`} strokeLinecap="round" strokeLinejoin="round" />

        {/* Accent dots every ~20% of points */}
        {dataPoints
          .filter((_, i) => i === 0 || i === maxX || (maxX > 4 && i % Math.max(1, Math.floor(maxX / 5)) === 0))
          .map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3"
              fill={lineColor} filter={`url(#${glowId})`} />
          ))}

        {/* Last point pulse ring */}
        <circle cx={sx(maxX)} cy={sy(last)} r="5"
          fill="none" stroke={lineColor} strokeWidth="1.5" strokeOpacity="0.5" />
        <circle cx={sx(maxX)} cy={sy(last)} r="3" fill={lineColor} />
        <circle cx={sx(maxX)} cy={sy(last)} r="1.5" fill="#000" />

        {/* X-axis line */}
        <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom}
          stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      </svg>
      <p style={{ margin: 0, fontSize: '10px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Evolución del capital
      </p>
    </div>
  )
}

function StatRow({ label, value, color = '#ffffff' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: '14px', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <span style={{ color: '#f87171' }}>⚠</span>
        <p style={{ color: '#f87171', fontSize: '14px', margin: 0 }}>{message}</p>
      </div>
      <button onClick={onClose} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
    </div>
  )
}

function NotificationCard({ notif, onClose }: { notif: SignalNotification; onClose: () => void }) {
  const style = opStyle(notif.operation.operacion)
  const isOpen = notif.operation.operacion.endsWith('_OPEN')
  const borderColor = isOpen
    ? (notif.operation.operacion.includes('LONG') ? 'rgba(52,211,153,0.4)' : 'rgba(192,132,252,0.4)')
    : 'rgba(255,255,255,0.1)'
  const bgColor = isOpen
    ? (notif.operation.operacion.includes('LONG') ? 'rgba(16,185,129,0.1)' : 'rgba(168,85,247,0.1)')
    : 'rgba(255,255,255,0.05)'

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '12px 16px', background: bgColor, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '24px' }}>{isOpen ? '🔔' : '✅'}</span>
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: style.color }}>{style.label}</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
            {notif.operation.par} @ ${fmt(notif.operation.precio)}
            {notif.operation.rsi !== null && ` · RSI: ${n(notif.operation.rsi).toFixed(1)}`}
            {notif.operation.pnl_usdt !== null && ` · P&L: ${n(notif.operation.pnl_usdt) >= 0 ? '+' : ''}$${fmt(notif.operation.pnl_usdt)}`}
            {notif.operation.razon && ` · ${notif.operation.razon}`}
          </p>
        </div>
      </div>
      <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
    </div>
  )
}

function OperationsTable({ ops }: { ops: Operation[] }) {
  if (ops.length === 0) {
    return <div style={{ padding: '64px 24px', textAlign: 'center', color: '#4b5563', fontSize: '14px' }}>Sin operaciones registradas aún.</div>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {['Fecha', 'Operación', 'Precio', 'RSI', 'P&L', 'Saldo', 'Razón'].map((h, i) => (
              <th key={h} style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', fontWeight: 600, textAlign: i >= 2 && i <= 5 ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ops.map((op) => {
            const style = opStyle(op.operacion)
            const pnl = n(op.pnl_usdt)
            const pnlColor = op.pnl_usdt === null ? '#4b5563' : pnl >= 0 ? '#34d399' : '#f87171'
            return (
              <tr key={op.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  {new Date(op.fecha).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 500, color: style.color, whiteSpace: 'nowrap' }}>{style.label}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#d1d5db', fontVariantNumeric: 'tabular-nums' }}>${fmt(op.precio)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{op.rsi !== null ? n(op.rsi).toFixed(1) : '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: pnlColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {op.pnl_usdt !== null ? `${pnl >= 0 ? '+' : ''}$${fmt(op.pnl_usdt)}` : '—'}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#d1d5db', fontVariantNumeric: 'tabular-nums' }}>${fmt(op.saldo_acumulado)}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.razon || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── BotPanel ──────────────────────────────────────────────────────────────────

interface BotPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  table: string
  visible: boolean
  onStatusChange: (s: 'connecting' | 'connected' | 'error') => void
  onNewSignal: () => void
}

function BotPanel({ supabase, table, visible, onStatusChange, onNewSignal }: BotPanelProps) {
  const [operations, setOperations]   = useState<Operation[]>([])
  const [notifications, setNotifications] = useState<SignalNotification[]>([])
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  // Refs para callbacks estables (evitan re-suscripciones innecesarias)
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange
  const onNewSignalRef = useRef(onNewSignal)
  onNewSignalRef.current = onNewSignal

  const dismissNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const addNotification = useCallback((op: Operation) => {
    const id = Date.now()
    setNotifications(prev => [{ id, operation: op }, ...prev].slice(0, 5))
    setTimeout(() => dismissNotification(id), 30000)
  }, [dismissNotification])

  useEffect(() => {
    onStatusChangeRef.current(realtimeStatus)
  }, [realtimeStatus])

  useEffect(() => {
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from(table)
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
      .channel(`trading-${table}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const newOp = payload.new as Operation
          setOperations(prev => [newOp, ...prev])
          addNotification(newOp)
          onNewSignalRef.current()
          setError(null)
        }
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .subscribe((status: any) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error')
          setError('Se perdió la conexión en tiempo real. Recarga la página para reconectar.')
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [supabase, table, addNotification])

  const stats = calcStats(operations)
  const pie   = getPieData(operations)
  const statusColor = realtimeStatus === 'connected' ? '#34d399' : realtimeStatus === 'error' ? '#f87171' : '#fbbf24'
  const statusLabel = realtimeStatus === 'connected' ? 'En vivo' : realtimeStatus === 'error' ? 'Sin conexión' : 'Conectando...'

  return (
    <div style={{ display: visible ? 'flex' : 'none', flexDirection: 'column', gap: '20px' }}>

      {/* Status badge */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${statusColor}40`, borderRadius: '9999px', padding: '6px 12px', background: `${statusColor}15` }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block', boxShadow: `0 0 8px ${statusColor}` }} />
          <span style={{ fontSize: '12px', color: statusColor }}>{statusLabel}</span>
        </div>
      </div>

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      {notifications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notifications.map(notif => (
            <NotificationCard key={notif.id} notif={notif} onClose={() => dismissNotification(notif.id)} />
          ))}
        </div>
      )}

      {/* Stats + Capital Chart + Pie card */}
      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)', boxShadow: '0 0 60px rgba(16,185,129,0.08), 0 0 100px rgba(168,85,247,0.08)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'flex-start' }}>

          {/* Stats */}
          <div style={{ flex: '1', minWidth: '200px', maxWidth: '280px' }}>
            <p style={{ margin: '0 0 2px 0', fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Resumen de cuenta</p>
            <p style={{ margin: '0 0 14px 0', fontSize: '11px', color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
              {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <StatRow label="Capital inicial" value="$1,000.00" />
            <StatRow label="Saldo actual" value={`$${fmt(stats.balance)}`} color={stats.balance >= 1000 ? '#34d399' : '#f87171'} />
            <StatRow
              label="P&L Total"
              value={`${stats.pnl >= 0 ? '+' : ''}$${fmt(stats.pnl)} (${stats.pnlPct >= 0 ? '+' : ''}${stats.pnlPct.toFixed(2)}%)`}
              color={stats.pnl >= 0 ? '#34d399' : '#f87171'}
            />
            <StatRow label="Ops. cerradas" value={stats.totalOps.toString()} />
            <StatRow label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate >= 50 ? '#34d399' : '#f87171'} />
            <StatRow label="USDT disponible" value={`$${fmt(pie.usdtAmt)}`} color="#34d399" />
            {pie.ethAmt > 0 && <StatRow label="En posición" value={`$${fmt(pie.ethAmt)}`} color="#c084fc" />}
          </div>

          <div style={{ width: '1px', background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.1), transparent)', alignSelf: 'stretch' }} />

          {/* Capital evolution line chart */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '2', minWidth: '280px' }}>
            <CapitalChart ops={operations} />
          </div>

          <div style={{ width: '1px', background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.1), transparent)', alignSelf: 'stretch' }} />

          {/* Pie chart */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}>
            <PieChart usdtPct={pie.usdtPct} ethPct={pie.ethPct} />
          </div>

        </div>
      </div>

      {/* Table card */}
      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(90deg, rgba(16,185,129,0.08) 0%, rgba(168,85,247,0.08) 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#e5e7eb' }}>Historial de operaciones</h2>
          <span style={{ fontSize: '12px', color: '#6b7280', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', padding: '4px 12px' }}>
            {operations.length} registros
          </span>
        </div>
        {loading ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '2px solid rgba(16,185,129,0.3)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
            <p style={{ color: '#4b5563', fontSize: '14px', margin: 0 }}>Cargando datos...</p>
          </div>
        ) : (
          <OperationsTable ops={operations} />
        )}
      </div>

    </div>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────

type TabId = 'v1' | 'v2'

const TABS: { id: TabId; label: string; sublabel: string }[] = [
  { id: 'v1', label: 'Bot v1',  sublabel: 'Long / Short' },
  { id: 'v2', label: 'Bot v2',  sublabel: 'Short Invertido' },
]

export default function Dashboard({ supabaseUrl, supabaseKey }: { supabaseUrl: string; supabaseKey: string }) {
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey])

  const [activeTab, setActiveTab] = useState<TabId>('v1')
  const [v1Status, setV1Status]   = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [v2Status, setV2Status]   = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [v1Unread, setV1Unread]   = useState(0)
  const [v2Unread, setV2Unread]   = useState(0)

  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab

  const handleV1Signal = useCallback(() => {
    if (activeTabRef.current !== 'v1') setV1Unread(prev => prev + 1)
  }, [])

  const handleV2Signal = useCallback(() => {
    if (activeTabRef.current !== 'v2') setV2Unread(prev => prev + 1)
  }, [])

  const switchTab = (tab: TabId) => {
    setActiveTab(tab)
    if (tab === 'v1') setV1Unread(0)
    if (tab === 'v2') setV2Unread(0)
  }

  const statusOf = (tab: TabId) => tab === 'v1' ? v1Status : v2Status
  const unreadOf = (tab: TabId) => tab === 'v1' ? v1Unread : v2Unread

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', color: '#ffffff', position: 'relative', overflowX: 'hidden', fontFamily: 'system-ui, sans-serif' }}>

      {/* Gradient blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-200px', left: '-200px', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.20) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '-200px', right: '-200px', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.20) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px', backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.6)' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, background: 'linear-gradient(90deg, #34d399, #ffffff, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Trading Dashboard
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>ETH/USDT 1H — Paper Trading</p>
        </div>
      </header>

      {/* Tab nav */}
      <div style={{ position: 'relative', zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '0 24px', display: 'flex', gap: '4px' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            const status = statusOf(tab.id)
            const unread = unreadOf(tab.id)
            const dotColor = status === 'connected' ? '#34d399' : status === 'error' ? '#f87171' : '#fbbf24'
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '14px 20px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: isActive ? '2px solid #34d399' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#ffffff' : '#6b7280' }}>{tab.label}</div>
                  <div style={{ fontSize: '11px', color: isActive ? '#9ca3af' : '#4b5563' }}>{tab.sublabel}</div>
                </div>
                {/* Realtime dot */}
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dotColor, display: 'inline-block', boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0 }} />
                {/* Unread badge */}
                {unread > 0 && (
                  <span style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#c084fc', color: '#000', fontSize: '10px', fontWeight: 700, borderRadius: '9999px', padding: '1px 5px', lineHeight: '1.4' }}>
                    {unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panels */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1152px', margin: '0 auto', padding: '24px' }}>
        <BotPanel
          supabase={supabase}
          table="eth_binance_trading_1h"
          visible={activeTab === 'v1'}
          onStatusChange={setV1Status}
          onNewSignal={handleV1Signal}
        />
        <BotPanel
          supabase={supabase}
          table="eth_binance_trading_v2"
          visible={activeTab === 'v2'}
          onStatusChange={setV2Status}
          onNewSignal={handleV2Signal}
        />
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
