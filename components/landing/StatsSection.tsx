'use client'
import { AnimatedCounter } from './AnimatedCounter'
import { useRef, useState, useEffect } from 'react'

const stats = [
  { icon: '⏰', value: 47, suffix: 'min', label: 'economizados por dia', detail: 'Em média por usuária' },
  { icon: '💰', value: 340, prefix: 'R$', suffix: '/mês', label: 'de prejuízo evitado', detail: 'Por precificação errada' },
  { icon: '📈', value: 94, suffix: '%', label: 'das usuárias crescem', detail: 'Nos 3 primeiros meses' },
  { icon: '⭐', value: 4.9, suffix: '/5', label: 'avaliação média', detail: 'Baseado em +200 reviews', decimals: 1 },
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
            Resultados que falam por si
          </h2>
          <p className="text-white/70 text-sm">Dados reais das nossas usuárias</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="text-center rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.2)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transition: `all 0.5s ease ${i * 0.12}s`,
              }}
            >
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-2xl sm:text-3xl font-bold text-white">
                <AnimatedCounter
                  to={s.value}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  decimals={s.decimals ?? 0}
                />
              </div>
              <p className="text-white/90 text-xs font-semibold mt-1">{s.label}</p>
              <p className="text-white/50 text-[10px] mt-0.5">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
