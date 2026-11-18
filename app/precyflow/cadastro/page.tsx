'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase-client'
import { ThemeRoot } from '@/components/precyflow/ThemeRoot'
import { Logo } from '@/components/precyflow/Logo'
import { Mascot } from '@/components/precyflow/Mascot'

const schema = z.object({
  name: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

type FormData = z.infer<typeof schema>

export default function CadastroPage() {
  const router = useRouter()
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
      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { name: data.name } },
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')) {
          setError('Este e-mail já está cadastrado.')
        } else {
          setError(signUpError.message)
        }
        return
      }

      router.push('/precyflow/onboarding')
      router.refresh()
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ThemeRoot>
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-6 text-center">
            <Mascot size={56} />
            <Logo className="mt-2" />
          </div>

          <div className="pf-card">
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--pf-text)' }}>Crie sua conta</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--pf-text-secondary)' }}>Comece a organizar seu negócio agora</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Nome</label>
                <input className="pf-input" placeholder="Seu nome" {...register('name')} />
                {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.name.message}</p>}
              </div>

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
                    autoComplete="new-password"
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

              <button type="submit" disabled={isLoading} className="pf-btn-primary w-full">
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {isLoading ? 'Criando conta...' : 'Criar conta grátis'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm" style={{ color: 'var(--pf-text-secondary)' }}>
              Já tem conta?{' '}
              <Link href="/precyflow/login" className="font-medium" style={{ color: 'var(--pf-primary)' }}>
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </ThemeRoot>
  )
}
