'use client'
import { useRef, useState, useEffect } from 'react'

const resolves = [
  { icon: '💰', text: 'Preço calculado com material + mão de obra + lucro, sem chute' },
  { icon: '🛒', text: 'Pedidos organizados, sem depender da memória ou do WhatsApp' },
  { icon: '📄', text: 'Orçamento profissional em PDF, pronto em 1 clique' },
  { icon: '📊', text: 'Visão clara do que entra e sai do seu negócio' },
]

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      className="py-20 px-4 sm:px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #8B6C4F 0%, #B8956A 50%, #C4A47B 100%)' }}
    >
      {/* decorativo */}
      <div className="absolute top-0 left-0 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.3)', transform: 'translate(-30%, -30%)' }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.3)', transform: 'translate(30%, 30%)' }} />

      <div className="relative max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            O que o Precy+ resolve, de verdade
          </h2>
          <p className="text-white/70 text-sm">Sem promessa vazia — só o que o sistema entrega hoje</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {resolves.map((r, i) => (
            <div
              key={r.text}
              className="flex items-center gap-4 rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.2)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transition: `all 0.5s ease ${i * 0.12}s`,
              }}
            >
              <span className="text-2xl flex-shrink-0">{r.icon}</span>
              <p className="text-white text-sm font-medium leading-snug">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
