import Link from 'next/link'
import { Lock, Sparkles } from 'lucide-react'

/**
 * Tela exibida no /montagem pra quem não é assinante ativo do Precy+ e
 * ainda não comprou o acesso avulso (ver app/montagem/page.tsx). O link
 * continua sendo /montagem — só o conteúdo muda conforme o acesso.
 */
export function MontagemPaywall() {
  return (
    <div className="card rounded-2xl p-8 max-w-xl mx-auto text-center space-y-5">
      <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center mx-auto">
        <Lock className="text-primary" size={26} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-text-primary dark:text-stone-100">Precy Montagem</h2>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1.5">
          Monte e aproveite artes gráficas em folhas ou bobinas, com cálculo exato de encaixe, borda, linha de corte e exportação em PDF/PNG.
        </p>
      </div>

      <div className="rounded-xl border border-border dark:border-border-dark p-4 text-left space-y-2">
        <p className="text-sm font-semibold text-text-primary dark:text-stone-100 flex items-center gap-1.5">
          <Sparkles size={14} className="text-primary" /> Já é assinante do Precy+?
        </p>
        <p className="text-sm text-text-secondary dark:text-stone-400">
          O Precy Montagem está incluído de graça no seu plano —{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">faça login</Link> pra usar direto.
        </p>
      </div>

      <div className="rounded-xl border border-border dark:border-border-dark p-4 text-left space-y-2">
        <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Não usa o Precy+?</p>
        <p className="text-sm text-text-secondary dark:text-stone-400">
          Compre o acesso avulso só ao Montagem, sem assinar o resto do sistema — <strong className="text-text-primary dark:text-stone-100">R$ 27,00 por 1 ano</strong>.
        </p>
        {/* Rótulo curto de propósito: o botão força white-space: nowrap
           (globals.css) — um texto mais longo com o preço junto vazava
           pra fora da borda em telas estreitas de celular; o preço já
           aparece destacado no parágrafo acima. */}
        <Link href="/montagem/comprar" className="btn-primary w-full justify-center mt-1">
          Comprar acesso
        </Link>
      </div>
    </div>
  )
}
