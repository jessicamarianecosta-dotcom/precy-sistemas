import { getAssinantes } from '@/lib/admin/getAssinantes'
import { AssinantesClient } from './AssinantesClient'

export default async function AdminAssinantesPage() {
  const assinantes = await getAssinantes()

  return <AssinantesClient initialData={assinantes} />
}
