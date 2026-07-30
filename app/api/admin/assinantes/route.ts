import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getAssinantes } from '@/lib/admin/getAssinantes'

const ADMIN_EMAIL = 'jessicamarianecosta@gmail.com'

/**
 * GET /api/admin/assinantes
 * Usado pelo painel /admin/assinantes para revalidar a lista quando chega um
 * evento Realtime de novo cadastro. Somente leitura — sem nenhuma ação de
 * escrita. Restrito ao e-mail da dona do sistema, checado de novo aqui (o
 * middleware já bloqueia, isso é defesa em profundidade contra chamada
 * direta à API).
 */
export async function GET() {
  const serverClient = createServerComponentClient({ cookies })
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const assinantes = await getAssinantes()
    return NextResponse.json({ assinantes })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
