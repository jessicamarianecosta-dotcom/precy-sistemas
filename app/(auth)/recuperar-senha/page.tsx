'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})

type Form = z.infer<typeof schema>

export default function RecuperarSenhaPage() {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: Form) {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/nova-senha`,
      })

      if (error) throw error
      setSent(true)
    } catch {
      setError('Erro ao enviar e-mail. Verifique o endereço e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="card animate-scaleIn text-center">
        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
        <h2 className="text-display-sm font-bold text-text-primary dark:text-stone-100 mb-2">
          E-mail enviado! 📧
        </h2>
        <p className="text-text-secondary dark:text-stone-400 mb-6">
          Verifique sua caixa de entrada e clique no link para redefinir sua senha.
        </p>
        <Link href="/login" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <div className="card animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-display-sm text-text-primary dark:text-stone-100 mb-1">
          Recuperar senha 🔑
        </h1>
        <p className="text-sm text-text-secondary dark:text-stone-400">
          Enviaremos um link para redefinir sua senha
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary dark:text-stone-200 mb-1.5">
            E-mail
          </label>
          <input
            type="email"
            placeholder="sua@empresa.com"
            className="input"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
        </div>

        {error && (
          <div className="bg-error-light text-error-dark text-sm px-4 py-3 rounded-xl border border-error/20">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
          {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link href="/login" className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
          <ArrowLeft size={14} />
          Voltar para o login
        </Link>
      </p>
    </div>
  )
}
