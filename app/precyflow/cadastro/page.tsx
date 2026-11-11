'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, UserPlus, CheckCircle } from 'lucide-react'
import { PrecyflowAuthCard } from '@/components/precyflow/AuthCard'
import { PLANS } from '@/lib/stripe/plans'

const cadastroSchema = z.object({
  name:            z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  company_name:    z.string().min(2, 'Nome do negócio deve ter ao menos 2 caracteres'),
  email:           z.string().email('E-mail inválido'),
  password:        z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  confirmPassword: z.string(),
  termsAccepted:   z.boolean(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
}).refine(data => data.termsAccepted === true, {
  message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar sua conta.',
  path: ['termsAccepted'],
})

type CadastroForm = z.infer<typeof cadastroSchema>

export default function PrecyflowCadastroPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState('Criando conta...')

  const { register, handleSubmit, formState: { errors } } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
  })

  async function onSubmit(data: CadastroForm) {
    setIsLoading(true)
    setError(null)

    try {
      setStep('Criando conta...')
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { name: data.name, company_name: data.company_name } },
      })

      if (authError) {
        setError(authError.message.includes('already registered')
          ? 'Este e-mail já está cadastrado.'
          : authError.message)
        return
      }
      if (!authData.user) {
        setError('Não foi possível criar a conta. Tente novamente.')
        return
      }

      setStep('Configurando acesso...')
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email, password: data.password,
      })
      if (signInError) {
        setSuccess(true)
        setTimeout(() => router.push('/precyflow/login'), 2000)
        return
      }

      setStep('Configurando seu negócio...')
      const setupRes = await fetch('/api/setup-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'precyflow' }),
      })
      if (!setupRes.ok) console.error('[precyflow/cadastro] setup-company error:', await setupRes.json().catch(() => ({})))

      setStep('Registrando aceite dos termos...')
      const acceptRes = await fetch('/api/legal/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      })
      if (!acceptRes.ok) console.error('[precyflow/cadastro] legal/accept error:', await acceptRes.json().catch(() => ({})))

      setStep('Preparando sua assinatura...')
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'precyflow' }),
      })
      const checkoutBody = await checkoutRes.json().catch(() => ({}))

      if (checkoutRes.ok && checkoutBody.url) {
        window.location.href = checkoutBody.url
        return
      }

      // Pagamento ainda não configurado (price_id do PrecyFlow faltando no
      // ambiente) — não bloqueia a criação da conta, só avisa. O acesso ao
      // app fica retido pelo middleware até a assinatura ser confirmada.
      console.error('[precyflow/cadastro] checkout indisponível:', checkoutBody)
      setSuccess(true)
      setTimeout(() => router.push('/precyflow/login'), 2500)
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <PrecyflowAuthCard>
        <div className="text-center animate-scaleIn">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 pf-text-primary-accent" />
          <h2 className="text-xl font-bold mb-2">Conta criada!</h2>
          <p style={{ color: 'var(--pf-text-secondary)' }}>
            Finalize a assinatura para acessar o PrecyFlow.
          </p>
        </div>
      </PrecyflowAuthCard>
    )
  }

  return (
    <PrecyflowAuthCard>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Criar conta no PrecyFlow</h1>
        <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
          {PLANS.precyflow.priceLabel} · até 300 produtos cadastrados
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Seu nome</label>
          <input type="text" autoComplete="name" placeholder="Seu nome completo" className="input" {...register('name')} />
          {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Nome do seu negócio</label>
          <input type="text" placeholder="Ex: Laços da Nina" className="input" {...register('company_name')} />
          {errors.company_name && <p className="mt-1 text-xs text-error">{errors.company_name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">E-mail</label>
          <input type="email" autoComplete="email" placeholder="sua@empresa.com" className="input" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Senha</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'} autoComplete="new-password"
              placeholder="Mínimo 6 caracteres" className="input pr-10" {...register('password')}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pf-text-muted)' }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-error">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Confirmar senha</label>
          <input type="password" autoComplete="new-password" placeholder="Repita a senha" className="input" {...register('confirmPassword')} />
          {errors.confirmPassword && <p className="mt-1 text-xs text-error">{errors.confirmPassword.message}</p>}
        </div>

        <div>
          <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--pf-text-secondary)' }}>
            <input type="checkbox" className="mt-0.5 w-4 h-4 rounded flex-shrink-0" {...register('termsAccepted')} />
            <span>
              Li e concordo com os{' '}
              <Link href="/termos" target="_blank" rel="noopener noreferrer" className="pf-text-primary-accent font-medium hover:underline">Termos de Uso</Link>
              {' '}e a{' '}
              <Link href="/privacidade" target="_blank" rel="noopener noreferrer" className="pf-text-primary-accent font-medium hover:underline">Política de Privacidade</Link>.
            </span>
          </label>
          {errors.termsAccepted && <p className="mt-1.5 text-xs text-error">{errors.termsAccepted.message}</p>}
        </div>

        {error && (
          <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl border border-error/20">{error}</div>
        )}

        <button type="submit" disabled={isLoading} className="pf-btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2 min-h-[44px]">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {isLoading ? step : `Criar conta — ${PLANS.precyflow.priceLabel}`}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
        Já tem conta?{' '}
        <Link href="/precyflow/login" className="pf-text-primary-accent font-medium hover:underline">Entrar</Link>
      </p>
    </PrecyflowAuthCard>
  )
}
