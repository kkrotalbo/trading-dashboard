# Trading Dashboard

Panel web en tiempo real para visualizar las señales generadas por el [trading-bot](https://github.com/kkrotalbo/trading-bot). Construido con Next.js 14 y Supabase Realtime.

## Características

- **Tiempo real**: recibe notificaciones de nuevas señales al instante, sin necesidad de refrescar la página (WebSocket via Supabase Realtime)
- **Notificaciones visuales**: alerta automática cuando el bot registra una apertura o cierre de posición, con auto-dismiss a los 30 segundos
- **Manejo de errores**: banner visible si hay problemas de conexión con Supabase
- **Estadísticas**: saldo actual, P&L total, número de operaciones y win rate
- **Historial completo**: tabla con todas las operaciones ordenadas de más reciente a más antigua
- **Responsive**: funciona en móvil, tablet y escritorio

## Requisitos

- Node.js 18+
- Proyecto en Supabase con la tabla `eth_binance_trading_1h` creada (ver [trading-bot](https://github.com/kkrotalbo/trading-bot))
- **Realtime habilitado** en la tabla (ver configuración más abajo)

## Instalación local

```bash
git clone https://github.com/kkrotalbo/trading-dashboard.git
cd trading-dashboard
npm install
```

Crea el archivo de variables de entorno:

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Ejecuta en modo desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Dónde obtener las credenciales de Supabase

En el panel de Supabase → botón **Connect** → pestaña **App Frameworks** → o ve a **Settings → API Keys**:

- `NEXT_PUBLIC_SUPABASE_URL`: la URL del proyecto (`https://xxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: la clave `anon public`

> La anon key es segura para exponer en el frontend — solo permite leer datos públicos de la tabla.

## Habilitar Realtime en Supabase

Para que las notificaciones en tiempo real funcionen, debes activar Realtime en la tabla:

1. En Supabase → **Database** → **Replication**
2. Activa la tabla `eth_binance_trading_1h`

O ejecuta en el SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE eth_binance_trading_1h;
```

## Deploy en Railway

1. Sube este repo a tu GitHub
2. En [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Selecciona el repo `trading-dashboard`
4. En **Variables**, agrega:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-ref.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu anon key de Supabase |

5. Railway detecta Next.js automáticamente y hace el build

Railway te dará una URL pública (ej: `trading-dashboard.railway.app`) accesible desde cualquier dispositivo.

## Estructura del proyecto

```
trading-dashboard/
├── app/
│   ├── layout.tsx       # Layout raíz con metadata
│   ├── page.tsx         # Dashboard principal (componente cliente)
│   └── globals.css      # Estilos globales + Tailwind
├── lib/
│   └── supabase.ts      # Cliente de Supabase
├── types/
│   └── trading.ts       # Tipos TypeScript de la tabla
├── .env.local.example   # Plantilla de variables de entorno
├── railway.toml         # Configuración de Railway
└── .gitignore           # Excluye .env.local y node_modules
```

## Cómo funciona el tiempo real

La app se suscribe a eventos `INSERT` en la tabla `eth_binance_trading_1h` usando Supabase Realtime (WebSockets). Cuando el bot registra una nueva operación:

1. Supabase emite el evento al navegador al instante
2. La nueva fila aparece en la tabla automáticamente
3. Se muestra una notificación visual con los detalles de la señal
4. La notificación se cierra sola después de 30 segundos (o manualmente)

El indicador en el header muestra el estado de la conexión en tiempo real:
- 🟢 **Tiempo real activo**: suscripción funcionando correctamente
- 🟡 **Conectando...**: estableciendo conexión inicial
- 🔴 **Sin conexión**: error en la suscripción, los datos pueden no estar actualizados
