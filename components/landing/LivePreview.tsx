'use client'
import { useEffect, useState, useRef } from 'react'

const activities = [
  { icon: '🛒', text: 'Novo pedido de Mariana — R$ 320', time: 'agora', color: '#3A7EC4' },
  { icon: '✅', text: 'Pedido #PED-1042 entregue', time: '2min', color: '#5C8B4F' },
  { icon: '⚠️', text: 'Estoque de tinta acrílica baixo', time: '8min', color: '#C4893A' },
  { icon: '💰', text: 'Pagamento de R$ 180 confirmado', time: '15min', color: '#5C8B4F' },
  { icon: '📄', text: 'Orçamento #ORC-0089 aprovado', time: '22min', color: '#8B6C4F' },
  { icon: '🎉', text: 'Meta do mês atingida: 100%', time: '1h', color: '#8B6C4F' },
]

function MiniBarChart({ values, color }: { values: number[], color: string }) {
  const [shown, setShown] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 300)
    return () => clearTimeout(t)
  }, [])
  return (
    <div ref={ref} className="flex items-end gap-1 h-10">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{
            height: shown ? `${v}%` : '4%',
            background: color,
            opacity: 0.7 + (i / values.length) * 0.3,
            transition: `height ${0.3 + i * 0.05}s cubic-bezier(0.34, 1.56, 0.64, 1)`,
          }}
        />
      ))}
    </div>
  )
}

export function LivePreview() {
  const [activityIndex, setActivityIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setActivityIndex(i => (i + 1) % activities.length)
    }, 2800)
    return () => clearInterval(t)
  }, [])

  return (
    <section ref={ref} className="py-24 px-4 sm:px-6 bg-[#FAF7F4] dark:bg-[rgba(255,255,255,0.02)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 bg-[rgba(139,108,79,0.1)] text-[#8B6C4F] text-xs font-semibold px-4 py-2 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-[#5C8B4F] animate-pulse" />
            Preview ao vivo do sistema
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#2C2018] dark:text-stone-100 mb-4">
            Veja o Precy+ em ação
          </h2>
          <p className="text-[#7A6855] dark:text-stone-400 max-w-xl mx-auto">
            Tudo que você precisa numa tela só — sem planilha, sem caderno, sem susto.
          </p>
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-5"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.6s ease',
          }}
        >
          {/* Mini financeiro */}
          <div className="rounded-2xl bg-white dark:bg-[#2A2220] border border-[#EDE8E2] dark:border-[#3A3028] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#2C2018] dark:text-stone-100">Financeiro do Mês</h3>
              <span className="text-[10px] bg-[rgba(92,139,79,0.1)] text-[#5C8B4F] font-semibold px-2 py-0.5 rounded-full">+18%</span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Receitas', value: 4820, total: 6000, color: '#5C8B4F' },
                { label: 'Despesas', value: 1200, total: 6000, color: '#C4503A' },
                { label: 'Lucro', value: 3620, total: 6000, color: '#8B6C4F' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-[#7A6855] dark:text-stone-400">{item.label}</span>
                    <span className="text-xs font-semibold" style={{ color: item.color }}>
                      R$ {item.value.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#EDE8E2] dark:bg-[#3A3028] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: visible ? `${(item.value / item.total) * 100}%` : '0%',
                        background: item.color,
                        transitionDelay: '0.5s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <div className="flex-1 rounded-xl p-3" style={{ background: 'rgba(92,139,79,0.06)' }}>
                <p className="text-[9px] text-[#B8A898] uppercase tracking-wider">Margem</p>
                <p className="text-base font-bold text-[#5C8B4F]">75%</p>
              </div>
              <div className="flex-1 rounded-xl p-3" style={{ background: 'rgba(139,108,79,0.06)' }}>
                <p className="text-[9px] text-[#B8A898] uppercase tracking-wider">Ticket</p>
                <p className="text-base font-bold text-[#8B6C4F]">R$167</p>
              </div>
            </div>
          </div>

          {/* Mini pedidos kanban */}
          <div className="rounded-2xl bg-white dark:bg-[#2A2220] border border-[#EDE8E2] dark:border-[#3A3028] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#2C2018] dark:text-stone-100">Kanban de Pedidos</h3>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#5C8B4F] animate-pulse" />
                <span className="text-[9px] text-[#B8A898]">ao vivo</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { status: 'Pendente', color: '#C4893A', bg: 'rgba(196,137,58,0.08)', count: 3, items: ['Kit festa', 'Vela P+', 'Caneca'] },
                { status: 'Produção', color: '#3A7EC4', bg: 'rgba(58,126,196,0.08)', count: 4, items: ['Papelaria', 'Adesivo', 'Copo'] },
                { status: 'Pronto', color: '#5C8B4F', bg: 'rgba(92,139,79,0.08)', count: 2, items: ['Box mensal', 'Kit bebe'] },
              ].map(col => (
                <div key={col.status} className="rounded-xl p-2" style={{ background: col.bg }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold" style={{ color: col.color }}>{col.status}</span>
                    <span className="text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center text-white"
                      style={{ background: col.color, fontSize: '8px' }}>{col.count}</span>
                  </div>
                  {col.items.map(item => (
                    <div key={item} className="bg-white dark:bg-[#2A2220] rounded-lg p-1.5 mb-1.5 last:mb-0">
                      <p className="text-[9px] text-[#2C2018] dark:text-stone-200 font-medium truncate">{item}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(92,139,79,0.08)' }}>
              <span className="text-xl">🎯</span>
              <div>
                <p className="text-xs font-semibold text-[#2C2018] dark:text-stone-100">Meta de pedidos</p>
                <p className="text-[10px] text-[#5C8B4F]">9 de 12 concluídos este mês</p>
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl bg-white dark:bg-[#2A2220] border border-[#EDE8E2] dark:border-[#3A3028] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#2C2018] dark:text-stone-100">Atividade Recente</h3>
              <span className="text-[10px] text-[#B8A898]">Hoje</span>
            </div>
            <div className="space-y-2.5">
              {activities.map((a, i) => (
                <div
                  key={a.text}
                  className="flex items-start gap-2.5 transition-all duration-500"
                  style={{
                    opacity: activityIndex === i || (activityIndex + 1) % activities.length === i
                      || (activityIndex + 2) % activities.length === i
                      || (activityIndex + 3) % activities.length === i ? 1 : 0.35,
                    transform: activityIndex === i ? 'translateX(4px)' : 'none',
                  }}
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: `${a.color}18` }}>
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-[#2C2018] dark:text-stone-100 leading-tight">{a.text}</p>
                    <p className="text-[9px] text-[#B8A898] mt-0.5">{a.time}</p>
                  </div>
                  {activityIndex === i && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#5C8B4F] flex-shrink-0 mt-2 animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
