import Link from 'next/link'
import { Cat } from 'lucide-react'

export function PrecyflowAuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--pf-bg)' }}>
      <div className="w-full max-w-md">
        <Link href="/precyflow" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg pf-btn-primary">
            <Cat size={20} />
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
