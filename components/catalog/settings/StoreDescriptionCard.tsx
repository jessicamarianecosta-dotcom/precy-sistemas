'use client'

import { AlignLeft, Lightbulb } from 'lucide-react'
import type { SettingsCardProps } from '@/app/(dashboard)/catalogo/catalogSettingsTypes'

const MAX_LENGTH = 500

const EXAMPLES = [
  'Há mais de 10 anos criando comunicação visual de qualidade para o seu negócio: banners, adesivos e placas com entrega rápida e acabamento profissional. 🎨',
  'Somos uma papelaria especializada em cartões de visita, panfletos e materiais gráficos personalizados. Atendimento rápido e preços justos para pequenos negócios. ✂️',
  'Produtos personalizados feitos à mão com carinho: canecas, camisetas e brindes únicos para presentear ou divulgar sua marca. Peça já o seu! 🎁',
]

export function StoreDescriptionCard({ value, onChange }: SettingsCardProps) {
  const text = value.description ?? ''
  const remaining = MAX_LENGTH - text.length

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h3 className="text-base font-bold text-text-primary dark:text-stone-100 flex items-center gap-2">
          <AlignLeft size={17} className="text-primary" /> Descrição da Loja
        </h3>
        <p className="text-sm text-text-secondary dark:text-stone-400 mt-1">
          Conte aos seus clientes o que sua empresa faz.
        </p>
      </div>

      <div>
        <textarea
          className="input resize-none"
          rows={5}
          maxLength={MAX_LENGTH}
          placeholder="Conte aos seus clientes o que sua empresa faz."
          value={text}
          onChange={e => onChange({ description: e.target.value })}
        />
        <p className={`text-[11px] mt-1 text-right ${remaining < 0 ? 'text-error' : 'text-text-muted dark:text-stone-500'}`}>
          {text.length} / {MAX_LENGTH} caracteres
        </p>
      </div>

      <div className="rounded-xl bg-primary-50 dark:bg-primary/10 p-3 flex items-start gap-2">
        <Lightbulb size={15} className="text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary dark:text-stone-300">Uma boa descrição aumenta a confiança dos clientes.</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">Exemplos</p>
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ description: ex })}
            className="w-full text-left text-xs text-text-secondary dark:text-stone-400 p-3 rounded-xl border border-border dark:border-border-dark hover:border-primary/40 hover:bg-primary-50/50 dark:hover:bg-primary/5 transition-colors"
          >
            <span className="font-semibold text-text-primary dark:text-stone-200">Exemplo {i + 1}: </span>{ex}
          </button>
        ))}
      </div>
    </div>
  )
}
