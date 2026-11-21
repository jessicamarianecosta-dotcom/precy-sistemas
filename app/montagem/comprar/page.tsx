import type { Metadata } from 'next'
import Link from 'next/link'
import { ComprarForm } from '@/components/montagem/ComprarForm'

export const metadata: Metadata = {
  title: 'Comprar acesso ao Precy Montagem',
  description: 'Acesso avulso de 1 ano ao Precy Montagem por R$ 27,00 — sem precisar assinar o Precy+. Cadastro simples e pagamento via Mercado Pago.',
  robots: { index: true, follow: true },
}

export default function MontagemComprarPage() {
  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <header className="border-b border-border dark:border-border-dark bg-white dark:bg-surface-dark">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/montagem" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-bold text-sm">P+</span>
            </div>
            <span className="font-bold text-text-primary dark:text-stone-100 truncate">Precy<span className="text-primary">+</span> Montagem</span>
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-10">
        <div className="card rounded-2xl p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-text-primary dark:text-stone-100">Acesso avulso — R$ 27,00/ano</h1>
            <p className="text-sm text-text-secondary dark:text-stone-400 mt-1.5">
              Libera o Precy Montagem por 1 ano, sem precisar assinar o resto do Precy+. Já é assinante do Precy+? O Montagem já está incluído —{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">faça login</Link> em vez de comprar aqui.
            </p>
          </div>
          <ComprarForm />
        </div>
      </main>
    </div>
  )
}
