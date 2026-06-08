'use client'
import { useEffect, useState, useRef } from 'react'

const bars = [38, 52, 44, 67, 58, 81, 71, 88, 76, 92, 85, 100]
const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function SparkLine({ color = '#8B6C4F' }: { color?: string }) {
  const points = [30, 45, 38, 55, 48, 62, 55, 72, 65, 80, 73, 88]
  const w = 120, h = 40
  const max = Math.max(...points), min = Math.min(...points)
  const norm = (v: number) => h - ((v - min) / (max - min)) * (h - 6) - 3
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (points.length - 1)) * w} ${norm(v)}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={path + ` L ${w} ${h} L 0 ${h} Z`} fill={`url(#sg-${color.replace('#','')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function HeroDashboard() {
  const [barsVisible, setBarsVisible] = useState(false)
  const [notifVisible, setNotifVisible] = useState(false)
  const [activeBar, setActiveBar] = useState<number | null>(null)
  const [orderTick, setOrderTick] = useState(0)
  const [revenue, setRevenue] = useState(3420)

  useEffect(() => {
    const t1 = setTimeout(() => setBarsVisible(true), 400)
    const t2 = setTimeout(() => setNotifVisible(true), 1200)
    const t3 = setInterval(() => {
      setOrderTick(p => (p + 1) % 3)
      setRevenue(p => p + Math.floor(Math.random() * 80 + 20))
    }, 3500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(t3) }
  }, [])

  const liveOrders = [
    { name: 'Ana Silva', item: 'Copo Personalizado', val: 'R$85', status: 'Produção', dot: '#3A7EC4' },
    { name: 'Carla Lima', item: 'Convite Casamento', val: 'R$240', status: 'Pronto', dot: '#5C8B4F' },
    { name: 'Julia Costa', item: 'Kit Papelaria', val: 'R$180', status: 'Pendente', dot: '#C4893A' },
  ]

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Glow de fundo */}
      <div
        className="absolute inset-0 rounded-3xl blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, #8B6C4F 0%, transparent 70%)' }}
      />

      {/* Card flutuante superior esquerdo */}
      <div
        className="absolute -top-6 -left-4 z-20 hidden sm:block"
        style={{ animation: 'float1 4s ease-in-out infinite' }}
      >
        <div className="bg-white dark:bg-[#2A2220] rounded-2xl shadow-[0_8px_32px_rgba(139,108,79,0.18)] border border-[#EDE8E2] dark:border-[#3A3028] px-4 py-3 flex items-center gap-3 min-w-[160px]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(92,139,79,0.12)' }}>
            💰
          </div>
          <div>
            <p className="text-[10px] font-medium text-[#B8A898] uppercase tracking-wider">Faturamento</p>
            <p className="text-base font-bold text-[#2C2018] dark:text-stone-100">
              R$ {revenue.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-[#5C8B4F] animate-pulse ml-auto" />
        </div>
      </div>

      {/* Card flutuante superior direito */}
      <div
        className="absolute -top-4 -right-4 z-20 hidden sm:block"
        style={{ animation: 'float2 5s ease-in-out infinite' }}
      >
        <div className="bg-white dark:bg-[#2A2220] rounded-2xl shadow-[0_8px_32px_rgba(139,108,79,0.18)] border border-[#EDE8E2] dark:border-[#3A3028] px-4 py-3">
          <p className="text-[10px] font-medium text-[#B8A898] uppercase tracking-wider mb-1">Pedidos hoje</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-[#2C2018] dark:text-stone-100">14</p>
            <span className="text-xs font-semibold text-[#5C8B4F] mb-1">+3 ↑</span>
          </div>
        </div>
      </div>

      {/* Card flutuante inferior esquerdo */}
      <div
        className="absolute -bottom-5 -left-2 z-20 hidden sm:block"
        style={{ animation: 'float3 6s ease-in-out infinite' }}
      >
        <div className="bg-white dark:bg-[#2A2220] rounded-2xl shadow-[0_8px_32px_rgba(139,108,79,0.18)] border border-[#EDE8E2] dark:border-[#3A3028] px-4 py-3 flex items-center gap-2.5">
          <span className="text-xl">⭐</span>
          <div>
            <p className="text-xs font-semibold text-[#2C2018] dark:text-stone-100">Nota do sistema</p>
            <div className="flex gap-0.5 mt-0.5">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-3 h-3 rounded-sm" style={{ background: '#8B6C4F', opacity: i <= 5 ? 1 : 0.2 }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notificação flutuante */}
      <div
        className="absolute -bottom-3 -right-2 z-20 hidden sm:block"
        style={{
          animation: 'float1 4.5s ease-in-out infinite',
          opacity: notifVisible ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      >
        <div className="bg-[#5C8B4F] rounded-2xl shadow-lg px-4 py-2.5 flex items-center gap-2.5 max-w-[200px]">
          <span className="text-lg">🛒</span>
          <div>
            <p className="text-[11px] font-bold text-white">Novo pedido!</p>
            <p className="text-[10px] text-white/80">Kit papelaria — R$ 180</p>
          </div>
        </div>
      </div>

      {/* Dashboard principal */}
      <div className="relative rounded-2xl overflow-hidden shadow-[0_20px_80px_rgba(139,108,79,0.22)] border border-[#EDE8E2] dark:border-[#3A3028]">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'linear-gradient(135deg, #8B6C4F 0%, #B8956A 100%)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-xs">P+</span>
            </div>
            <span className="text-white font-semibold text-sm">Precy+ Sistemas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#5C8B4F] animate-pulse" />
            <span className="text-white/80 text-xs">Ao vivo</span>
          </div>
        </div>

        {/* Dashboard body */}
        <div className="bg-[#FAF7F4] dark:bg-[#1C1714] p-4 space-y-3">
          {/* Metric cards row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Faturamento', val: `R$ ${(revenue/1000).toFixed(1)}k`, icon: '📈', color: '#5C8B4F', bg: 'rgba(92,139,79,0.08)' },
              { label: 'Lucro', val: 'R$ 1,2k', icon: '💵', color: '#8B6C4F', bg: 'rgba(139,108,79,0.08)' },
              { label: 'Pedidos', val: '14', icon: '🛒', color: '#3A7EC4', bg: 'rgba(58,126,196,0.08)' },
              { label: 'Estoque', val: '✓ OK', icon: '📦', color: '#5C8B4F', bg: 'rgba(92,139,79,0.08)' },
            ].map((m, i) => (
              <div
                key={m.label}
                className="rounded-xl p-2.5 bg-white dark:bg-[#2A2220] border border-[#EDE8E2] dark:border-[#3A3028]"
                style={{ animationDelay: `${i * 0.1}s`, animation: 'fadeSlideUp 0.5s ease both' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-medium text-[#B8A898] uppercase tracking-wider truncate">{m.label}</span>
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px]" style={{ background: m.bg }}>
                    {m.icon}
                  </div>
                </div>
                <p className="text-sm font-bold text-[#2C2018] dark:text-stone-100">{m.val}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-xl bg-white dark:bg-[#2A2220] border border-[#EDE8E2] dark:border-[#3A3028] p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#2C2018] dark:text-stone-100">Faturamento mensal</p>
              <span className="text-[10px] bg-[rgba(92,139,79,0.12)] text-[#5C8B4F] font-semibold px-2 py-0.5 rounded-full">+23% ↑</span>
            </div>
            <div className="flex items-end gap-1.5 h-16">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm relative cursor-pointer transition-all duration-200"
                  style={{
                    height: barsVisible ? `${h}%` : '4%',
                    background: i === 11 || i === activeBar
                      ? 'linear-gradient(180deg, #8B6C4F, #B8956A)'
                      : 'rgba(139,108,79,0.18)',
                    transition: `height ${0.4 + i * 0.04}s cubic-bezier(0.34, 1.56, 0.64, 1)`,
                  }}
                  onMouseEnter={() => setActiveBar(i)}
                  onMouseLeave={() => setActiveBar(null)}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {months.filter((_, i) => i % 3 === 0).map(m => (
                <span key={m} className="text-[9px] text-[#B8A898]">{m}</span>
              ))}
            </div>
          </div>

          {/* Live orders */}
          <div className="rounded-xl bg-white dark:bg-[#2A2220] border border-[#EDE8E2] dark:border-[#3A3028] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#2C2018] dark:text-stone-100">Pedidos recentes</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#5C8B4F] animate-pulse" />
                <span className="text-[9px] text-[#B8A898]">em tempo real</span>
              </div>
            </div>
            <div className="space-y-2">
              {liveOrders.map((o, i) => (
                <div
                  key={o.name}
                  className="flex items-center justify-between"
                  style={{
                    opacity: 1,
                    animation: `fadeSlideRight 0.4s ease both`,
                    animationDelay: `${0.8 + i * 0.15}s`,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: o.dot }}>
                      {o.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-[#2C2018] dark:text-stone-100 truncate">{o.name}</p>
                      <p className="text-[9px] text-[#B8A898] truncate">{o.item}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-[10px] font-bold text-[#8B6C4F]">{o.val}</p>
                    <p className="text-[9px] font-medium" style={{ color: o.dot }}>{o.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(-4px) rotate(1deg); }
          50% { transform: translateY(8px) rotate(-0.5deg); }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(0px) rotate(0.5deg); }
          50% { transform: translateY(-12px) rotate(-1deg); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideRight {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
