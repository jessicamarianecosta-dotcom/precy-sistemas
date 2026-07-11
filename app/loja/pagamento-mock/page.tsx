'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'

/**
 * Página de desenvolvimento — só é alcançada quando o adapter de pagamento
 * está em modo mock (INFINITYPAY_MODE=mock ou sem credenciais). Simula a
 * confirmação de pagamento chamando o mesmo webhook que a InfinityPay
 * chamaria em produção, permitindo testar a cascata automática
 * (Pedidos/Financeiro/Clientes/Estoque/Agenda) sem credenciais reais.
 */
function MockPaymentContent() {
  const params = useSearchParams()
  const ref = params.get('ref') ?? ''
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function confirm() {
    setStatus('loading')
    try {
      const res = await fetch('/api/webhooks/infinitypay', {
        method: 'POST',
        body: JSON.stringify({ ref, status: 'paid', amount: 0, paymentMethod: 'pix' }),
      })
      if (!res.ok) throw new Error()
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-6 max-w-sm w-full text-center">
        <h1 className="text-base font-bold text-text-primary dark:text-stone-100 mb-2">Pagamento simulado</h1>
        <p className="text-xs text-text-muted mb-5">Referência: {ref}</p>

        {status === 'done' ? (
          <div className="flex flex-col items-center gap-2 text-success">
            <CheckCircle size={32} />
            <p className="text-sm font-medium">Pagamento confirmado!</p>
          </div>
        ) : (
          <button onClick={confirm} disabled={status === 'loading'} className="btn-primary w-full flex items-center justify-center gap-2">
            {status === 'loading' && <Loader2 size={15} className="animate-spin" />}
            Simular pagamento aprovado
          </button>
        )}
        {status === 'error' && <p className="text-xs text-error mt-2">Erro ao confirmar. Tente novamente.</p>}
      </div>
    </div>
  )
}

export default function MockPaymentPage() {
  return (
    <Suspense fallback={null}>
      <MockPaymentContent />
    </Suspense>
  )
}
