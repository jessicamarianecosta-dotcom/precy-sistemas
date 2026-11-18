'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase-client'
import { ThemeRoot } from '@/components/precyflow/ThemeRoot'
import { Logo } from '@/components/precyflow/Logo'
import { Mascot } from '@/components/precyflow/Mascot'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe sua senha'),
})

type FormData = z.infer<typeof schema>

function getSafeRedirect(raw: string | null): string {
  if (!raw) return '/precyflow/app/dashboard'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/precyflow/app/dashboard'
  return raw
}

export default function PrecyFlowLoginPage() {
  return (
    <ThemeRoot>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </ThemeRoot>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('E-mail ou senha incorretos.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Confirme seu e-mail antes de entrar. Procure o link de confirmação na sua caixa de entrada.')
        } else {
          setError(signInError.message)
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
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <Mascot size={56} />
          <Logo className="mt-2" />
        </div>

        <div className="pf-card">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--pf-text)' }}>Bem-vinda de volta!</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--pf-text-secondary)' }}>Entre para continuar sua gestão</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>E-mail</label>
              <input type="email" autoComplete="email" className="pf-input" placeholder="sua@email.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pf-input pr-10"
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--pf-text-muted)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.password.message}</p>}
            </div>

            {error && (
              <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)', color: 'var(--pf-error)' }}>
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Link href="/precyflow/recuperar-senha" className="text-sm" style={{ color: 'var(--pf-primary)' }}>
                Esqueci minha senha
              </Link>
            </div>

            <button type="submit" disabled={isLoading} className="pf-btn-primary w-full">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
            Não tem conta?{' '}
            <Link href="/precyflow/cadastro" className="font-medium" style={{ color: 'var(--pf-primary)' }}>
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
