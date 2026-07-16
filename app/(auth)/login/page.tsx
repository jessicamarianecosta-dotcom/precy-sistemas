'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

function getSafeRedirect(raw: string | null): string {
  // Só aceita caminho relativo interno (evita open redirect via ?redirect=//evil.com
  // ou ?redirect=https://evil.com).
  if (!raw) return '/dashboard'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('E-mail ou senha incorretos.')
        } else {
          setError(error.message)
        }
        return
      }

      router.push(getSafeRedirect(searchParams.get('redirect')))
      router.refresh()
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="card animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-display-sm text-text-primary dark:text-stone-100 mb-1">
          Bem-vinda de volta! 👋
        </h1>
        <p className="text-sm text-text-secondary dark:text-stone-400">
          Entre na sua conta para continuar
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              autoComplete="current-password"
              placeholder="••••••••"
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

        {/* Erro geral */}
        {error && (
          <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl border border-error/20">
            {error}
          </div>
        )}

        {/* Esqueci a senha */}
        <div className="flex justify-end">
          <Link
            href="/recuperar-senha"
            className="text-sm text-primary hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 min-h-[44px]"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <LogIn size={16} />
          )}
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      {/* Cadastro */}
      <p className="mt-6 text-center text-sm text-text-secondary dark:text-stone-400">
        Não tem conta?{' '}
        <Link href="/cadastro" className="text-primary font-medium hover:underline">
          Criar conta grátis
        </Link>
      </p>

      {/* Trial badge */}
      <div className="mt-4 text-center">
        <span className="badge badge-success text-xs">
          ✨ 7 dias grátis • Sem cartão de crédito
        </span>
      </div>
    </div>
  )
}
