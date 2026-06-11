import Link from 'next/link'

interface Props {
  title: string
  subtitle: string
  updated: string
  children: React.ReactNode
}

export function LegalLayout({ title, subtitle, updated, children }: Props) {
  return (
    <div className="min-h-screen bg-[#0F0B08] text-stone-200">
      {/* Header */}
      <div className="border-b border-stone-800/60 bg-[#0F0B08]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-bold">P+</div>
            <span className="text-sm font-bold text-stone-100 group-hover:text-primary transition-colors">Precy+</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-stone-500">
            <Link href="/termos"     className="hover:text-stone-300 transition-colors">Termos</Link>
            <Link href="/privacidade" className="hover:text-stone-300 transition-colors">Privacidade</Link>
            <Link href="/reembolso"  className="hover:text-stone-300 transition-colors">Reembolso</Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="border-b border-stone-800/40 py-10 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] font-bold tracking-widest uppercase text-primary mb-2">{subtitle}</p>
          <h1 className="text-3xl font-bold text-white mb-3">{title}</h1>
          <p className="text-sm text-stone-500">Última atualização: {updated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-5 py-10 prose-legal">
        {children}
      </div>

      {/* Footer */}
      <div className="border-t border-stone-800/40 py-8 px-5 text-center">
        <p className="text-xs text-stone-600">
          © {new Date().getFullYear()} Precy+ Sistemas. Todos os direitos reservados. &nbsp;·&nbsp;
          <a href="mailto:suporte@precyplus.com.br" className="hover:text-stone-400 transition-colors">suporte@precyplus.com.br</a>
        </p>
      </div>

      <style jsx global>{`
        .prose-legal h2 { font-size: 1.1rem; font-weight: 700; color: #e7e0d9; margin: 2rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(139,108,79,0.15); }
        .prose-legal h3 { font-size: 0.95rem; font-weight: 600; color: #c4b8ac; margin: 1.25rem 0 0.5rem; }
        .prose-legal p  { font-size: 0.875rem; line-height: 1.75; color: #a09080; margin-bottom: 0.875rem; }
        .prose-legal ul { font-size: 0.875rem; line-height: 1.75; color: #a09080; margin: 0.5rem 0 0.875rem 1.25rem; list-style: disc; }
        .prose-legal li { margin-bottom: 0.25rem; }
        .prose-legal a  { color: #B8956A; text-decoration: underline; }
        .prose-legal strong { color: #d4c4b4; font-weight: 600; }
        .prose-legal .highlight { background: rgba(139,108,79,0.08); border-left: 3px solid #8B6C4F; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 1rem 0; }
      `}</style>
    </div>
  )
}
