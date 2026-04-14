export const dynamic = 'force-dynamic'

import Dashboard from './dashboard'

export default function Page() {
  const supabaseUrl = process.env.SUPABASE_URL ?? ''
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? ''

  if (!supabaseUrl || !supabaseKey) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-6 py-4 text-red-400 text-sm">
          ⚠ Variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY no configuradas.
        </div>
      </div>
    )
  }

  return <Dashboard supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />
}
