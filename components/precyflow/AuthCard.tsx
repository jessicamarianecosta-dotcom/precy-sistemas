'use client'

import Link from 'next/link'
import { Cat, Sparkles } from 'lucide-react'
import { usePrecyflowTheme } from '@/providers/PrecyflowThemeProvider'

export function PrecyflowAuthCard({ children }: { children: React.ReactNode }) {
  const { theme } = usePrecyflowTheme()
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--pf-bg)' }}>
      <div className="w-full max-w-md">
        <Link href="/precyflow" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg pf-btn-primary">
            {theme === 'cat' ? <Cat size={20} /> : <Sparkles size={20} />}
          </div>
          <span className="text-2xl font-bold">
            Precy<span className="pf-text-primary-accent">Flow</span>
          </span>
        </Link>
        <div className="pf-card p-6">{children}</div>
      </div>
    </div>
  )
}
