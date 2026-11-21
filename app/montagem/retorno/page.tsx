'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

const POLL_INTERVAL_MS = 2500
const MAX_ATTEMPTS = 12 // ~30s

export default function MontagemRetornoPage() {
  return (
    <Suspense fallback={null}>
      <MontagemRetornoContent />
    </Suspense>
  )
}

function MontagemRetornoContent() {
  const params = useSearchParams()
  const router = useRouter()
  const ref = params.get('ref')
  const [status, setStatus] = useState<'checking' | 'approved' | 'pending' | 'error'>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!ref) { setStatus('error'); return }
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`/api/montagem/confirmar?ref=${encodeURIComponent(ref!)}`)
        const data = await res.json()
        if (cancelled) return
        if (data.status === 'approved') {
          setStatus('approved')
          setTimeout(() => router.replace('/montagem'), 1200)
        } else if (data.status === 'pending') {
          setStatus('pending')
        } else {
          setStatus('error')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    check()
    const interval = setInterval(() => {
      setAttempt((a) => {
        if (a + 1 >= MAX_ATTEMPTS) { clearInterval(interval); return a }
        check()
        return a + 1
      })
    }, POLL_INTERVAL_MS)

    return () => { cancelled = true; clearInterval(interval) }
  }, [ref, router])

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center px-4">
      <div className="card rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        {status === 'checking' || status === 'pending' ? (
          <>
            <Loader2 className="mx-auto animate-spin text-primary" size={32} />
            <h1 className="text-lg font-bold text-text-primary dark:text-stone-100">Confirmando seu pagamento…</h1>
            <p className="text-sm text-text-secondary dark:text-stone-400">
              {status === 'pending'
                ? 'O pagamento ainda está sendo processado pelo Mercado Pago. Isso pode levar alguns instantes — não feche esta página.'
                : 'Só um momento.'}
            </p>
          </>
        ) : status === 'approved' ? (
          <>
            <CheckCircle2 className="mx-auto text-success" size={32} />
            <h1 className="text-lg font-bold text-text-primary dark:text-stone-100">Pagamento confirmado!</h1>
            <p className="text-sm text-text-secondary dark:text-stone-400">Redirecionando para o Precy Montagem…</p>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto text-error" size={32} />
            <h1 className="text-lg font-bold text-text-primary dark:text-stone-100">Ainda não conseguimos confirmar</h1>
            <p className="text-sm text-text-secondary dark:text-stone-400">
              Se o pagamento foi concluído, aguarde mais um pouco e atualize esta página — a confirmação pode demorar um pouco a mais em alguns casos.
            </p>
            <button onClick={() => window.location.reload()} className="btn-secondary w-full justify-center">
              Atualizar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
