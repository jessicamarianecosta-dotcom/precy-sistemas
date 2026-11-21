import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers, Scissors, PaintBucket, FileDown, Ruler, ShieldCheck, Sparkles } from 'lucide-react'
import { ComprarForm } from '@/components/montagem/ComprarForm'

export const metadata: Metadata = {
  title: 'Comprar acesso ao Precy Montagem',
  description: 'Acesso avulso de 1 ano ao Precy Montagem por R$ 27,00 — sem precisar assinar o Precy+. Cadastro simples e pagamento via Mercado Pago.',
  robots: { index: true, follow: true },
}

const FEATURES = [
  { icon: Ruler, title: 'Encaixe exato', desc: 'Calcula colunas, linhas e aproveitamento real em folha ou bobina, sem chute.' },
  { icon: PaintBucket, title: 'Borda/sangria', desc: 'Adiciona borda colorida ao redor da arte, inclusive pra usar como sangria de corte.' },
  { icon: Scissors, title: 'Linha de corte', desc: 'Contorno vetorizado da faca, pronto pra CorelDRAW, FlexiSign ou SignCut.' },
  { icon: Layers, title: 'Folha, bobina ou peça única', desc: 'Monta em grade pra impressão em lote ou exporta só uma peça, no tamanho dela.' },
  { icon: FileDown, title: 'Exportação PDF/PNG', desc: 'Arquivo pronto pra imprimir, sem sobra de espaço em branco ao redor.' },
  { icon: ShieldCheck, title: 'Processado no navegador', desc: 'Sua arte nunca é enviada nem guardada em nenhum servidor.' },
]

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

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-50 dark:bg-primary/10 rounded-full px-3 py-1">
            <Sparkles size={12} /> Acesso avulso, sem assinar o resto do sistema
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary dark:text-stone-100">
            Precy Montagem — imposição de artes por R$ 27,00/ano
          </h1>
          <p className="text-sm sm:text-base text-text-secondary dark:text-stone-400 max-w-xl mx-auto">
            Monte e aproveite artes gráficas em folhas ou bobinas, com cálculo exato de encaixe, borda, linha de corte e exportação pronta pra imprimir.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card rounded-2xl p-4 flex gap-3 items-start">
              <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary dark:text-stone-100">{title}</p>
                <p className="text-xs text-text-secondary dark:text-stone-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Compra */}
        <div className="card rounded-2xl p-6 max-w-md mx-auto space-y-5">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Acesso por 1 ano</p>
            <p className="text-3xl font-bold text-primary mt-1">R$ 27,00</p>
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary dark:text-stone-100">Comece agora</h2>
            <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
              Já é assinante do Precy+? O Montagem já está incluído —{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">faça login</Link> em vez de comprar aqui.
            </p>
          </div>
          <ComprarForm />
        </div>
      </main>

      <footer className="max-w-[1400px] mx-auto px-4 py-8 text-center text-xs text-text-muted dark:text-stone-500">
        Precy Montagem é uma ferramenta do{' '}
        <Link href="/" className="text-primary hover:underline">Precy+</Link>.
      </footer>
    </div>
  )
}
