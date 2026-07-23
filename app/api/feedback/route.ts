import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

const ALLOWED_TYPES     = ['sugestao', 'bug', 'reclamacao', 'elogio', 'nova_funcionalidade']
const ALLOWED_PRIORITY  = ['baixa', 'normal', 'alta']
const ALLOWED_EXTS      = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']
const MAX_SIZE          = 10 * 1024 * 1024 // 10MB
const MESSAGE_MIN       = 30
const MESSAGE_MAX       = 3000

/** Destinatário da notificação por e-mail de cada feedback recebido —
 * usado assim que a infraestrutura de envio (ver TODO abaixo) existir. */
const FEEDBACK_NOTIFICATION_EMAIL = 'costajessicamariane@gmail.com'

/** Espelha public.company_has_paid_plan() — trial nunca passa aqui, mesmo
 * com acesso PRO temporário concedido em outros módulos do sistema. */
function hasPaidPlan(company: {
  role: string | null
  subscription_status: string | null
  current_period_end: string | null
  grace_period_end: string | null
}): boolean {
  if (company.role === 'developer') return true
  const status = company.subscription_status
  if (status === 'active') return true
  if (status === 'past_due' && company.grace_period_end && new Date() < new Date(company.grace_period_end)) return true
  if (status === 'canceled' && company.current_period_end && new Date() < new Date(company.current_period_end)) return true
  return false
}

/**
 * POST /api/feedback
 * Recebe multipart/form-data: type, subject, message, priority,
 * allow_contact ('true'|'false'), file (opcional).
 *
 * Validação de acesso pago é feita aqui no backend (não só escondendo o
 * menu no frontend) — replica a mesma regra da RLS (company_has_paid_plan),
 * então mesmo que este endpoint tivesse algum bug, a tabela feedbacks em si
 * já rejeitaria o insert de uma empresa em trial.
 */
export async function POST(request: Request) {
  try {
    const serverClient = createServerComponentClient({ cookies })
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: company, error: companyErr } = await (supabaseAdmin.from('companies') as any)
      .select('id, name, current_plan, subscription_status, current_period_end, grace_period_end, role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (companyErr || !company) {
      return NextResponse.json({ error: 'Empresa não encontrada para este usuário' }, { status: 404 })
    }

    if (!hasPaidPlan(company)) {
      return NextResponse.json(
        { error: 'Este recurso estará disponível após a assinatura de um plano pago.' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const type         = String(formData.get('type') ?? '')
    const subject      = String(formData.get('subject') ?? '').trim()
    const message      = String(formData.get('message') ?? '').trim()
    const priority     = String(formData.get('priority') ?? 'normal')
    const allowContact = String(formData.get('allow_contact') ?? 'false') === 'true'
    const file          = formData.get('file') as File | null

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipo de feedback inválido' }, { status: 400 })
    }
    if (!subject || subject.length > 200) {
      return NextResponse.json({ error: 'Assunto é obrigatório (máximo 200 caracteres)' }, { status: 400 })
    }
    if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
      return NextResponse.json({ error: `Mensagem deve ter entre ${MESSAGE_MIN} e ${MESSAGE_MAX} caracteres` }, { status: 400 })
    }
    if (!ALLOWED_PRIORITY.includes(priority)) {
      return NextResponse.json({ error: 'Prioridade inválida' }, { status: 400 })
    }

    let attachmentUrl: string | null = null

    if (file && file.size > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXTS.includes(ext)) {
        return NextResponse.json({ error: `Tipo de arquivo não permitido: .${ext}` }, { status: 400 })
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'Arquivo muito grande. Máximo 10MB.' }, { status: 400 })
      }

      const path = `${company.id}/${randomUUID()}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('feedback-attachments')
        .upload(path, buffer, { upsert: false, contentType: file.type || undefined })
      if (uploadErr) {
        return NextResponse.json({ error: `Erro ao enviar anexo: ${uploadErr.message}` }, { status: 500 })
      }

      const { data: urlData } = supabaseAdmin.storage.from('feedback-attachments').getPublicUrl(path)
      attachmentUrl = urlData.publicUrl
    }

    const { data: feedback, error: insertErr } = await (supabaseAdmin.from('feedbacks') as any)
      .insert([{
        company_id:     company.id,
        user_id:        user.id,
        type,
        subject,
        message,
        priority,
        allow_contact:  allowContact,
        attachment_url: attachmentUrl,
        status:         'novo',
      }])
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: `Erro ao registrar feedback: ${insertErr.message}` }, { status: 500 })
    }

    // TODO: quando a infraestrutura de e-mail transacional existir no
    // projeto (ver lib/email/), disparar aqui a notificação para
    // FEEDBACK_NOTIFICATION_EMAIL com os dados de company/user/feedback já
    // resolvidos acima. Propositalmente não implementado agora — não há
    // provedor de e-mail configurado neste projeto ainda.

    return NextResponse.json({ ok: true, feedback })
  } catch (err) {
    console.error('[feedback] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
