import { NextResponse } from 'next/server'
import { requireNotasFiscaisAccess } from '@/lib/notasFiscais/server-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/notas-fiscais
 *
 * Lista as notas fiscais da empresa (pedido, cliente, status, data) para
 * a tela principal do módulo. Beta: checa de novo aqui dentro mesmo já
 * bloqueado no middleware — nunca confiar só nisso.
 */
export async function GET() {
  const auth = await requireNotasFiscaisAccess()
  if (!auth.ok) return auth.response

  const { data, error } = await (supabaseAdmin.from('fiscal_invoices') as any)
    .select(`
      id, status, bling_status, bling_number, access_key, danfe_url, xml_url,
      created_at, sent_at, error_message, origin, avulsa_numero, total,
      order:orders(id, order_number, total),
      customer:customers(id, name)
    `)
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoices: data ?? [] })
}
