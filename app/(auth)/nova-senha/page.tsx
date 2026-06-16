'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Eye, EyeOff, CheckCircle, Loader2, AlertCircle } from 'lucide-react'

const schema = z.object({
  password:        z.string().min(6, 'Mínima de 6 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path:    ['confirmPassword'],
})
type Form = z.infer<typeof schema>

export default function NovaSenhaPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [validToken,  setValidToken]  = useState<boolean | null>(null) // null = verificando

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  /* ── Verificar sessão do link de recuperação ── */
  useEffect(() => {
    async function checkSession() {
      // Supabase processa o hash (#access_token=...) automaticamente
      const { data: { session } } = await supabase.auth.getSession()
      setValidToken(!!session)
    }
    // Pequeno delay para o Supabase processar o hash da URL
    setTimeout(checkSession, 500)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: Form) {
    setLoading(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      })
      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2500)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao redefinir senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Verificando token ── */
  if (validToken === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 size={28} className="text-primary animate-spin" />
        <p className="mt-3 text-sm text-text-secondary dark:text-stone-400">Verificando link...</p>
      </div>
    )
  }

  /* ── Token inválido ou expirado ── */
  if (validToken === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="card max-w-sm w-full text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-error-light flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-error" />
          </div>
          <h1 className="text-lg font-bold text-text-primary dark:text-stone-100 mb-2">
            Link inválido ou expirado
          </h1>
          <p className="text-sm text-text-secondary dark:text-stone-400 mb-6">
            Este link de recuperação expirou ou já foi utilizado. Solicite um novo link.
          </p>
          <a href="/recuperar-senha" className="btn-primary block text-center w-full">
            Solicitar novo link
          </a>
        </div>
      </div>
    )
  }

  /* ── Sucesso ── */
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="card max-w-sm w-full text-center p-8 animate-scaleIn">
          <div className="w-14 h-14 rounded-2xl bg-success-light flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={24} className="text-success" />
          </div>
          <h1 className="text-lg font-bold text-text-primary dark:text-stone-100 mb-2">
            Senha redefinida!
          </h1>
          <p className="text-sm text-text-secondary dark:text-stone-400">
            Redirecionando para o painel...
          </p>
        </div>
      </div>
    )
  }

  /* ── Formulário ── */
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="card max-w-sm w-full p-8 animate-scaleIn">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock size={22} className="text-primary" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-text-primary dark:text-stone-100 text-center mb-1">
          Criar nova senha
        </h1>
        <p className="text-sm text-text-secondary dark:text-stone-400 text-center mb-6">
          Escolha uma senha segura para a sua conta.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nova senha */}
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
              Nova senha
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Mínimo 6 caracteres"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-error">{errors.password.message}</p>
            )}
          </div>

          {/* Confirmar senha */}
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
              Confirmar senha
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Repita a nova senha"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-error">{errors.confirmPassword.message}</p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-error-light border border-error/20">
              <AlertCircle size={14} className="text-error flex-shrink-0 mt-0.5" />
              <p className="text-xs text-error-dark">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
              : <><CheckCircle size={15} /> Salvar nova senha</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
