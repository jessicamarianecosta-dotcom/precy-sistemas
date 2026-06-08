'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, UserPlus, CheckCircle } from 'lucide-react'

const cadastroSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  company_name: z.string().min(2, 'Nome do negócio deve ter ao menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type CadastroForm = z.infer<typeof cadastroSchema>

export default function CadastroPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
  })

  async function onSubmit(data: CadastroForm) {
    setIsLoading(true)
    setError(null)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            company_name: data.company_name,
          },
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este e-mail já está cadastrado.')
        } else {
          setError(authError.message)
        }
        return
      }

      if (authData.user) {
        await supabase.from('companies').insert({
          user_id: authData.user.id,
          name: data.company_name,
          email: data.email,
        })

        setSuccess(true)
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="card animate-scaleIn text-center">
        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
        <h2 className="text-display-sm font-bold text-text-primary dark:text-stone-100 mb-2">
          Conta criada! 🎉
        </h2>
        <p className="text-text-secondary dark:text-stone-400">
          Redirecionando para o dashboard...
        </p>
      </div>
    )
  }

  return (
    <div className="card animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-display-sm text-text-primary dark:text-stone-100 mb-1">
          Criar conta grátis ✨
        </h1>
        <p className="text-sm text-text-secondary dark:text-stone-400">
          7 dias grátis, sem cartão de crédito
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
            Seu nome
          </label>
          <input
            type="text"
            autoComplete="name"
            placeholder="Seu nome completo"
            className="input"
            {...register('name')}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-error">{errors.name.message}</p>
          )}
        </div>

        {/* Nome do negócio */}
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
            Nome do seu negócio
          </label>
          <input
            type="text"
            placeholder="Ex: Ateliê da Maria"
            className="input"
            {...register('company_name')}
          />
          {errors.company_name && (
            <p className="mt-1 text-xs text-error">{errors.company_name.message}</p>
          )}
        </div>

        {/* E-mail */}
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
            E-mail
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="sua@empresa.com"
            className="input"
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-error">{errors.email.message}</p>
          )}
        </div>

        {/* Senha */}
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
            Senha
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              className="input pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-error">{errors.password.message}</p>
          )}
        </div>

        {/* Confirmar Senha */}
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
            Confirmar senha
          </label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Repita a senha"
            className="input"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-error">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Erro geral */}
        {error && (
          <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl border border-error/20">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <UserPlus size={16} />
          )}
          {isLoading ? 'Criando conta...' : 'Criar conta grátis'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary dark:text-stone-400">
        Já tem conta?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Entrar
        </Link>
      </p>

      <div className="mt-4 text-center">
        <span className="badge badge-success text-xs">
          ✨ 7 dias grátis • Sem cartão de crédito
        </span>
      </div>

      <p className="mt-3 text-center text-xs text-text-muted dark:text-stone-500">
        Ao criar sua conta, você concorda com nossos{' '}
        <Link href="/termos" className="text-primary hover:underline">
          termos de uso
        </Link>
      </p>
    </div>
  )
}
