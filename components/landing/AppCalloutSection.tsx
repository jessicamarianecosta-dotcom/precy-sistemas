'use client'

import { Download, Share, Smartphone, Monitor } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export function AppCalloutSection() {
  const { platform, isStandalone, canPromptInstall, promptInstall } = useInstallPrompt()

  if (isStandalone) return null

  return (
    <section className="py-16 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-3xl border border-[#EDE8E2] dark:border-[#3A3028] bg-white dark:bg-[#2A2220] p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}>
            📲
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl sm:text-2xl font-bold text-[#2C2018] dark:text-stone-100 mb-2">
              O Precy+ também é um app!
            </h3>
            <p className="text-sm text-[#7A6855] dark:text-stone-400 leading-relaxed mb-4 max-w-xl">
              Instale no celular ou no computador e acesse com um toque — direto da tela inicial
              ou da área de trabalho, sem precisar abrir o navegador.
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-[#EDE8E2] dark:border-[#3A3028] text-[#7A6855] dark:text-stone-400">
                <Smartphone size={12} /> Celular
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-[#EDE8E2] dark:border-[#3A3028] text-[#7A6855] dark:text-stone-400">
                <Monitor size={12} /> Computador
              </span>
            </div>
          </div>

          <div className="flex-shrink-0 w-full sm:w-auto">
            {canPromptInstall && (
              <button onClick={promptInstall}
                className="w-full sm:w-auto text-sm font-semibold text-white py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.3)' }}>
                <Download size={14} /> Instalar app
              </button>
            )}

            {!canPromptInstall && platform === 'ios' && (
              <p className="text-xs text-[#7A6855] dark:text-stone-400 flex items-center gap-1 justify-center sm:justify-start max-w-[220px]">
                Toque em <Share size={12} className="inline" /> e depois em &ldquo;Adicionar à Tela de Início&rdquo;
              </p>
            )}

            {!canPromptInstall && platform !== 'ios' && (
              <p className="text-xs text-[#B8A898] text-center sm:text-left max-w-[220px]">
                Disponível para instalação no Chrome, Edge e Safari
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
