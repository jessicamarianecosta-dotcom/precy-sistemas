'use client'

import Link from 'next/link'

export function PrecyflowAuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--pf-bg)' }}>
      <div className="w-full max-w-md">
        <Link href="/precyflow" className="flex items-center justify-center gap-3 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/precyflow/mascote/gatinho-oficial.png" alt="" className="w-12 h-12 object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/precyflow/wordmark.png" alt="PrecyFlow" className="h-8 object-contain" />
        </Link>
        <div className="pf-card p-6">{children}</div>
      </div>
    </div>
  )
}
