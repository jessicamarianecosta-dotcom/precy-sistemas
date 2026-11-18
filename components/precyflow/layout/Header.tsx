'use client'

import { Menu } from 'lucide-react'

/* Sem campo de busca global aqui de propósito: cada módulo (Produtos,
   Materiais, Clientes, Fornecedores) já tem sua própria busca ligada aos
   dados reais da tela. Um campo "Buscar no PrecyFlow..." decorativo no
   cabeçalho, sem nada por trás, seria exatamente o tipo de tela-que-só-
   parece-funcional que o guia de implementação pede para evitar. */
export function Header({
  storeName,
  userEmail,
  onOpenMobile,
}: {
  storeName: string
  userEmail: string | null
  onOpenMobile: () => void
}) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 lg:px-8"
      style={{ backgroundColor: 'var(--pf-surface)', borderBottom: '1px solid var(--pf-border)' }}
    >
      <button onClick={onOpenMobile} className="lg:hidden" aria-label="Abrir menu" style={{ color: 'var(--pf-text-secondary)' }}>
        <Menu size={22} />
      </button>
      <div className="flex items-center gap-2 text-sm ml-auto" style={{ color: 'var(--pf-text-secondary)' }}>
        <span className="font-medium" style={{ color: 'var(--pf-text)' }}>{storeName}</span>
        {userEmail && <span className="hidden sm:inline">· {userEmail}</span>}
      </div>
    </header>
  )
}
