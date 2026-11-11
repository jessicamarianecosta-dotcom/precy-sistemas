'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { PrecyflowAuthCard } from '@/components/precyflow/AuthCard'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

function getSafeRedirect(raw: string | null): string {
  if (!raw) return '/precyflow/app'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/precyflow/app'
  return raw
}

export default function PrecyflowLoginPage() {
  return (
    <Suspense fallback={null}>
      <PrecyflowLoginForm />
    </Suspense>
  )
}

function PrecyflowLoginForm() {
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
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
      if (error) {
        setError(error.message.includes('Invalid login credentials') ? 'E-mail ou senha incorretos.' : error.message)
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
    <PrecyflowAuthCard>
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">Bem-vinda de volta!</h1>
        <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>Entre na sua conta para continuar</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">E-mail</label>
          <input type="email" autoComplete="email" placeholder="sua@empresa.com" className="input" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Senha</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'} autoComplete="current-password"
              placeholder="••••••••" className="input pr-10" {...register('password')}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pf-text-muted)' }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-error">{errors.password.message}</p>}
        </div>

        {error && (
          <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl border border-error/20">{error}</div>
        )}

        <div className="flex justify-end">
          <Link href="/recuperar-senha" className="text-sm pf-text-primary-accent hover:underline">Esqueci minha senha</Link>
        </div>

        <button type="submit" disabled={isLoading} className="pf-btn-primary w-full flex items-center justify-center gap-2 py-3 min-h-[44px]">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
        Não tem conta?{' '}
        <Link href="/precyflow/cadastro" className="pf-text-primary-accent font-medium hover:underline">Criar conta</Link>
      </p>
    </PrecyflowAuthCard>
  )
}
