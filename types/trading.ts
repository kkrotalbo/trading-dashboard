export interface Operation {
  id: number
  fecha: string
  par: string
  operacion: 'LONG_OPEN' | 'LONG_CLOSE' | 'SHORT_OPEN' | 'SHORT_CLOSE'
  precio: number | string
  monto_operacion: number | string
  apalancamiento: number
  exposicion_usdt: number | string
  rsi: number | string | null
  pnl_usdt: number | string | null
  pnl_pct: number | string | null
  saldo_acumulado: number | string
  variacion_pct: number | string | null
  razon: string | null
  created_at: string
}

export interface SignalNotification {
  id: number
  operation: Operation
}
