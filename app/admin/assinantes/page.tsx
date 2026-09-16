import { getAssinantes } from '@/lib/admin/getAssinantes'
import { AssinantesClient } from './AssinantesClient'

export default async function AdminAssinantesPage() {
  try {
    const assinantes = await getAssinantes()
    return <AssinantesClient initialData={assinantes} />
  } catch (error) {
    // Registra no servidor (aparece nos logs de runtime da Vercel,
    // correlacionável pelo digest mostrado ao usuário) sem derrubar
    // a página inteira — o erro vira um estado tratado no client.
    console.error('[admin/assinantes] falha ao carregar assinantes:', error)
    return (
      <AssinantesClient
        initialData={[]}
        initialError="Não foi possível carregar a lista de assinantes agora."
      />
    )
  }
}
