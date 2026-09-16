'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw, ArrowLeft } from 'lucide-react'

// Rede de segurança para falhas que acontecem antes do try/catch em
// page.tsx (ex.: uma variável de ambiente ausente derruba o módulo
// inteiro no import, não dentro da função do Server Component).
// Sem isso, um erro nesse ponto quebra a aplicação inteira em vez de
// só essa rota — era o que causava a tela "Application error" no
// painel de assinantes.
export default function AssinantesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin/assinantes] erro não tratado:', error)
  }, [error])

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary dark:text-stone-400 hover:text-primary dark:hover:text-primary mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        Voltar ao painel
      </Link>
      <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
        <AlertTriangle size={28} className="text-error" />
        <div>
          <p className="text-sm font-semibold text-text-primary dark:text-stone-100">
            Não foi possível carregar os assinantes
          </p>
          <p className="mt-1 text-xs text-text-secondary dark:text-stone-400">
            Ocorreu um erro inesperado no servidor{error.digest ? ` (código ${error.digest})` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="btn btn-secondary inline-flex items-center gap-1.5 text-xs"
        >
          <RotateCw size={13} />
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
