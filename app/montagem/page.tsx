import type { Metadata } from 'next'
import Link from 'next/link'
import { MontagemStudio } from '@/components/montagem/MontagemStudio'
import { ThemeToggleButton } from '@/components/montagem/ThemeToggleButton'

export const metadata: Metadata = {
  title: 'Montagem de Artes Gráficas Online e Gratuita',
  description: 'Monte e aproveite artes para impressão em folhas (A4, A3, A5 ou personalizada) ou bobinas. Calcule o encaixe exato, visualize e exporte em PDF ou PNG — grátis, sem cadastro.',
  alternates: { canonical: '/montagem' },
  robots: { index: true, follow: true },
}

export default function MontagemPublicPage() {
  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <header className="border-b border-border dark:border-border-dark bg-white dark:bg-surface-dark">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-bold text-sm">P+</span>
            </div>
            <span className="font-bold text-text-primary dark:text-stone-100 truncate">Precy<span className="text-primary">+</span> Montagem</span>
          </Link>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              Conhecer o Precy+
            </Link>
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <MontagemStudio variant="public" />
      </main>

      <footer className="max-w-[1400px] mx-auto px-4 py-8 text-center text-xs text-text-muted dark:text-stone-500">
        PRECY MONTAGEM é uma ferramenta gratuita do{' '}
        <Link href="/" className="text-primary hover:underline">Precy+</Link>.
        Nenhum arquivo enviado aqui é armazenado em nossos servidores.
      </footer>
    </div>
  )
}
