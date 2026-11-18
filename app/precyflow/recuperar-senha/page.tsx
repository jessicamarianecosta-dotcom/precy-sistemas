'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase-client'
import { ThemeRoot } from '@/components/precyflow/ThemeRoot'
import { Logo } from '@/components/precyflow/Logo'

const schema = z.object({ email: z.string().email('E-mail inválido') })
type FormData = z.infer<typeof schema>

export default function PrecyFlowRecuperarSenhaPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/precyflow/nova-senha`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch {
      setError('Erro ao enviar e-mail. Verifique o endereço e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ThemeRoot>
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-6 text-center">
            <Logo />
          </div>

          {sent ? (
            <div className="pf-card text-center">
              <CheckCircle size={48} style={{ color: 'var(--pf-success)' }} className="mx-auto mb-4" />
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--pf-text)' }}>E-mail enviado!</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--pf-text-secondary)' }}>
                Verifique sua caixa de entrada e clique no link para redefinir sua senha.
              </p>
              <Link href="/precyflow/login" className="pf-btn-secondary inline-flex">
                <ArrowLeft size={16} /> Voltar para o login
              </Link>
            </div>
          ) : (
            <div className="pf-card">
              <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--pf-text)' }}>Recuperar senha</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--pf-text-secondary)' }}>Enviaremos um link para redefinir sua senha</p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>E-mail</label>
                  <input type="email" className="pf-input" placeholder="sua@email.com" {...register('email')} />
                  {errors.email && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.email.message}</p>}
                </div>

                {error && (
                  <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)', color: 'var(--pf-error)' }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="pf-btn-primary w-full">
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
              </form>

              <p className="mt-6 text-center">
                <Link href="/precyflow/login" className="text-sm inline-flex items-center gap-1" style={{ color: 'var(--pf-primary)' }}>
                  <ArrowLeft size={14} /> Voltar para o login
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </ThemeRoot>
  )
}
