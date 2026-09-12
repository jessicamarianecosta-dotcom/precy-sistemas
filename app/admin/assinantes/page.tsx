import { getAssinantes } from '@/lib/admin/getAssinantes'
import { AssinantesClient } from './AssinantesClient'

export default async function AdminAssinantesPage() {
  try {
    const assinantes = await getAssinantes()
    return <AssinantesClient initialData={assinantes} />
  } catch (e: any) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="card p-6">
          <h1 className="text-lg font-bold text-text-primary dark:text-stone-100 mb-2">
            Não foi possível carregar os assinantes
          </h1>
          <p className="text-sm text-text-secondary dark:text-stone-400 mb-3">
            A consulta ao Supabase falhou. Verifique se a variável de ambiente
            <code className="mx-1 px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>
            configurada na Vercel ainda é válida (pode ter sido rotacionada no painel do Supabase).
          </p>
          <p className="text-xs text-error font-mono break-all">{e?.message ?? String(e)}</p>
        </div>
      </div>
    )
  }
}
