'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/precyflow/supabase'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Eye, EyeOff, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { ThemeRoot } from '@/components/precyflow/ThemeRoot'

const schema = z.object({
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function PrecyFlowNovaSenhaPage() {
  const supabase = createClient()
  const router = useRouter()

  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validToken, setValidToken] = useState<boolean | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) setValidToken(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) setValidToken(true)
    })

    const timeout = setTimeout(() => {
      if (!cancelled) setValidToken(prev => prev ?? false)
    }, 3000)

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: FormData) {
    setLoading(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: data.password })
      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => router.push('/precyflow/app/dashboard'), 2500)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao redefinir senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (validToken === null) {
    return (
      <ThemeRoot>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--pf-primary)' }} />
          <p className="mt-3 text-sm" style={{ color: 'var(--pf-text-secondary)' }}>Verificando link...</p>
        </div>
      </ThemeRoot>
    )
  }

  if (validToken === false) {
    return (
      <ThemeRoot>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="pf-card max-w-sm w-full text-center">
            <AlertCircle size={28} style={{ color: 'var(--pf-error)' }} className="mx-auto mb-4" />
            <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--pf-text)' }}>Link inválido ou expirado</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--pf-text-secondary)' }}>
              Este link de recuperação expirou ou já foi utilizado. Solicite um novo link.
            </p>
            <a href="/precyflow/recuperar-senha" className="pf-btn-primary block w-full">Solicitar novo link</a>
          </div>
        </div>
      </ThemeRoot>
    )
  }

  if (success) {
    return (
      <ThemeRoot>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="pf-card max-w-sm w-full text-center">
            <CheckCircle size={28} style={{ color: 'var(--pf-success)' }} className="mx-auto mb-4" />
            <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--pf-text)' }}>Senha redefinida!</h1>
            <p className="text-sm" style={{ color: 'var(--pf-text-secondary)' }}>Redirecionando para o painel...</p>
          </div>
        </div>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="pf-card max-w-sm w-full">
          <div className="flex justify-center mb-4">
            <Lock size={22} style={{ color: 'var(--pf-primary)' }} />
          </div>
          <h1 className="text-xl font-bold text-center mb-1" style={{ color: 'var(--pf-text)' }}>Criar nova senha</h1>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--pf-text-secondary)' }}>Escolha uma senha segura para a sua conta.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Nova senha</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="pf-input pr-10" placeholder="Mínimo 6 caracteres" {...register('password')} />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pf-text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Confirmar senha</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} className="pf-input pr-10" placeholder="Repita a nova senha" {...register('confirmPassword')} />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pf-text-muted)' }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.confirmPassword.message}</p>}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)' }}>
                <AlertCircle size={14} style={{ color: 'var(--pf-error)' }} className="flex-shrink-0 mt-0.5" />
                <p className="text-xs" style={{ color: 'var(--pf-error)' }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="pf-btn-primary w-full mt-2">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <><CheckCircle size={15} /> Salvar nova senha</>}
            </button>
          </form>
        </div>
      </div>
    </ThemeRoot>
  )
}
