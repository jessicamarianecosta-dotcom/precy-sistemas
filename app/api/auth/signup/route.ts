import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/auth/signup
 * Cria o usuário já com e-mail confirmado (Admin API, service role),
 * pra login funcionar na sequência sem esperar o clique no e-mail de
 * confirmação. Antes, app/(auth)/cadastro/page.tsx chamava
 * supabase.auth.signUp() direto no client — se "Confirm email" estiver
 * ligado nas configs do projeto Supabase, isso cria o usuário mas sem
 * sessão, e o signInWithPassword() logo depois falha com "Email not
 * confirmed", deixando a pessoa de volta na tela de login mesmo
 * parecendo que o cadastro deu certo. Com email_confirm:true aqui, a
 * conta já nasce confirmada e o login imediatamente após funciona
 * independente dessa config do projeto.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const email    = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const name         = typeof body?.name === 'string' ? body.name.trim() : ''
    const companyName  = typeof body?.company_name === 'string' ? body.company_name.trim() : ''

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, company_name: companyName },
    })

    if (error) {
      // Mensagens do GoTrue variam de versão pra versão, por isso o
      // match é por substring em vez de um código fixo.
      const alreadyExists = /already.*registered|already.*exists|duplicate/i.test(error.message)
      return NextResponse.json(
        { error: alreadyExists ? 'Este e-mail já está cadastrado.' : error.message },
        { status: alreadyExists ? 409 : 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Não foi possível criar a conta. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ userId: data.user.id })
  } catch (err) {
    console.error('[auth/signup] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
