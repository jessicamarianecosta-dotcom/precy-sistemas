'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/precyflow/supabase'
import { slugify, randomSuffix } from '@/lib/precyflow/slug'
import { ThemeRoot } from '@/components/precyflow/ThemeRoot'
import { Logo } from '@/components/precyflow/Logo'
import { Mascot } from '@/components/precyflow/Mascot'
import type { PrecyFlowAccent } from '@/lib/precyflow/types'

const schema = z.object({
  name: z.string().min(2, 'Informe o nome do seu negócio'),
  theme: z.enum(['cat', 'cores']),
  theme_color: z.enum(['rosa', 'azul', 'lilas', 'preto', 'verde', 'marrom']),
})

type FormData = z.infer<typeof schema>

const ACCENTS: { value: PrecyFlowAccent; label: string; swatch: string }[] = [
  { value: 'rosa', label: 'Rosa', swatch: '#D6447D' },
  { value: 'azul', label: 'Azul-claro', swatch: '#2F9FC4' },
  { value: 'lilas', label: 'Lilás', swatch: '#8B6FD0' },
  { value: 'preto', label: 'Preto/Branco', swatch: '#1F1B1D' },
  { value: 'verde', label: 'Verde', swatch: '#4F8B6C' },
  { value: 'marrom', label: 'Marrom', swatch: '#8B6C4F' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { theme: 'cat', theme_color: 'rosa' },
  })

  const theme = watch('theme')
  const accent = watch('theme_color')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/precyflow/login')
      else setCheckingAuth(false)
    })
  }, [supabase, router])

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/precyflow/login')
        return
      }

      const baseSlug = slugify(data.name)
      let slug = baseSlug
      let attempt = 0

      // Tenta o slug "limpo" primeiro; em colisão (loja de outra conta com
      // o mesmo nome), acrescenta um sufixo curto até conseguir — mais
      // simples que checar disponibilidade antes e ter corrida entre as
      // duas chamadas.
      while (attempt < 5) {
        const { error: insertError } = await supabase.from('precyflow_stores').insert({
          owner_id: session.user.id,
          name: data.name,
          slug,
          theme: data.theme,
          theme_color: data.theme_color,
        })

        if (!insertError) {
          router.push('/precyflow/app/dashboard')
          router.refresh()
          return
        }

        if (insertError.code === '23505') {
          attempt += 1
          slug = `${baseSlug}-${randomSuffix()}`
          continue
        }

        throw insertError
      }

      throw new Error('Não foi possível gerar um identificador único para a loja.')
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Erro ao criar sua loja. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <ThemeRoot>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--pf-primary)' }} />
        </div>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot theme={theme} accent={accent}>
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6 text-center">
            {theme === 'cat' && <Mascot size={56} />}
            <Logo className="mt-2" />
          </div>

          <div className="pf-card">
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--pf-text)' }}>Vamos configurar sua loja</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--pf-text-secondary)' }}>Leva menos de um minuto</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pf-text)' }}>Nome do seu negócio</label>
                <input className="pf-input" placeholder="Ex: Ateliê Flor de Fita" {...register('name')} />
                {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--pf-error)' }}>{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--pf-text)' }}>Tema</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setValue('theme', 'cat')}
                    className="pf-card !p-3 text-left"
                    style={{ borderColor: theme === 'cat' ? 'var(--pf-primary)' : 'var(--pf-border)', borderWidth: theme === 'cat' ? 2 : 1 }}
                  >
                    <Mascot size={28} />
                    <div className="mt-1 text-sm font-medium" style={{ color: 'var(--pf-text)' }}>Cat</div>
                    <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Mascote + rosa</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('theme', 'cores')}
                    className="pf-card !p-3 text-left"
                    style={{ borderColor: theme === 'cores' ? 'var(--pf-primary)' : 'var(--pf-border)', borderWidth: theme === 'cores' ? 2 : 1 }}
                  >
                    <div className="flex gap-1">
                      {ACCENTS.slice(0, 4).map(a => (
                        <span key={a.value} className="w-3 h-3 rounded-full" style={{ backgroundColor: a.swatch }} />
                      ))}
                    </div>
                    <div className="mt-1 text-sm font-medium" style={{ color: 'var(--pf-text)' }}>Cores</div>
                    <div className="text-xs" style={{ color: 'var(--pf-text-secondary)' }}>Sem mascote</div>
                  </button>
                </div>
              </div>

              {theme === 'cores' && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--pf-text)' }}>Cor</label>
                  <div className="flex flex-wrap gap-3">
                    {ACCENTS.map(a => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setValue('theme_color', a.value)}
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: a.swatch, outline: accent === a.value ? '2px solid var(--pf-text)' : 'none', outlineOffset: 2 }}
                        aria-label={a.label}
                        title={a.label}
                      >
                        {accent === a.value && <Check size={16} color="#fff" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="text-sm px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--pf-error-bg)', color: 'var(--pf-error)' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="pf-btn-primary w-full">
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                {isLoading ? 'Criando...' : 'Começar a usar o PrecyFlow'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </ThemeRoot>
  )
}
