'use client'

import { CheckCircle, Sparkles } from 'lucide-react'

const TIPS = [
  'Utilize um logo em alta resolução.',
  'Escolha um banner claro e leve.',
  'Escreva uma descrição objetiva.',
  'Utilize um WhatsApp atualizado.',
  'Organize produtos por categoria.',
]

export function HelpTipsCard() {
  return (
    <div className="card p-5 space-y-3 bg-primary-50/50 dark:bg-primary/5 border-primary/20">
      <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
        <Sparkles size={17} className="text-primary" /> Dicas para deixar sua loja mais profissional
      </h3>
      <ul className="space-y-2">
        {TIPS.map(tip => (
          <li key={tip} className="flex items-start gap-2 text-sm text-text-secondary dark:text-stone-300">
            <CheckCircle size={15} className="text-success flex-shrink-0 mt-0.5" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  )
}
