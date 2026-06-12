'use client'
import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { clsx }            from 'clsx'
import { useSubscription } from '@/hooks/useSubscription'
import {
  Play, BookOpen, Lock, Crown, X, ExternalLink,
  Clock, Tag, ChevronRight,
} from 'lucide-react'

/* ─── Types ─── */
type ContentType = 'video' | 'ebook'
type Category = 'all' | 'video' | 'ebook'

interface Content {
  id:          number
  title:       string
  description: string
  type:        ContentType
  category:    string
  duration?:   string
  isPro:       boolean
}

/* ─── Dados estáticos ─── */
const CONTENTS: Content[] = [
  /* ── VÍDEOS (free para todos) ── */
  {
    id: 1, type: 'video', isPro: false, category: 'Onboarding',
    title: 'Primeiros passos no Precy+',
    description: 'Configure sua conta, cadastre sua empresa e explore o painel principal. Tudo em menos de 10 minutos.',
    duration: '9 min',
  },
  {
    id: 2, type: 'video', isPro: false, category: 'Precificação',
    title: 'Precificação inteligente na prática',
    description: 'Configure materiais, mão de obra, custos fixos e calcule o preço ideal automaticamente.',
    duration: '14 min',
  },
  {
    id: 3, type: 'video', isPro: false, category: 'Produtos',
    title: 'Como criar e gerenciar produtos',
    description: 'Cadastre produtos, organize por categoria, defina unidades e crie fichas técnicas completas.',
    duration: '8 min',
  },
  {
    id: 4, type: 'video', isPro: false, category: 'Pedidos',
    title: 'Gestão de pedidos com Kanban',
    description: 'Crie pedidos, mova entre status e acompanhe o andamento da produção pelo quadro visual.',
    duration: '11 min',
  },
  {
    id: 5, type: 'video', isPro: false, category: 'Orçamentos',
    title: 'Como gerar orçamentos em PDF',
    description: 'Monte orçamentos profissionais, personalize com sua marca e envie para seus clientes.',
    duration: '10 min',
  },
  {
    id: 6, type: 'video', isPro: false, category: 'Estoque',
    title: 'Controlando o estoque',
    description: 'Cadastre materiais, controle entradas, monitore estoque mínimo e receba alertas automáticos.',
    duration: '7 min',
  },
  {
    id: 7, type: 'video', isPro: false, category: 'Agenda',
    title: 'Agenda e controle de entregas',
    description: 'Organize compromissos, sincronize pedidos com a agenda e visualize toda a semana de produção.',
    duration: '8 min',
  },
  {
    id: 8, type: 'video', isPro: false, category: 'Financeiro',
    title: 'Módulo financeiro completo',
    description: 'Registre receitas e despesas, acompanhe o saldo e entenda o lucro real do seu negócio.',
    duration: '12 min',
  },

  /* ── EBOOKS (exclusivo PRO) ── */
  {
    id: 9, type: 'ebook', isPro: true, category: 'Precificação',
    title: 'Guia completo de precificação para gráficas',
    description: 'Metodologia passo a passo para precificar banners, adesivos, lonas e personalizados com margem real de lucro.',
  },
  {
    id: 10, type: 'ebook', isPro: true, category: 'Financeiro',
    title: 'Gestão financeira para pequenos negócios',
    description: 'Como organizar o financeiro, separar contas, calcular lucro e planejar o crescimento do seu negócio.',
  },
  {
    id: 11, type: 'ebook', isPro: true, category: 'Produção',
    title: 'Fluxo de produção profissional',
    description: 'Organize sua produção do pedido à entrega, reduza erros e aumente a capacidade sem precisar contratar.',
  },
  {
    id: 12, type: 'ebook', isPro: true, category: 'Vendas',
    title: 'Estratégias de vendas para personalizados',
    description: 'Como precificar, vender e fidelizar clientes no mercado de personalizados e comunicação visual.',
  },
  {
    id: 13, type: 'ebook', isPro: true, category: 'Produtividade',
    title: 'Produtividade para empreendedoras criativas',
    description: 'Técnicas práticas para organizar tempo, rotina de produção e crescer sem sobrecarregar.',
  },
  {
    id: 14, type: 'ebook', isPro: true, category: 'Marketing',
    title: 'Marketing digital para gráficas e personalizados',
    description: 'Instagram, WhatsApp Business e portfólio para atrair novos clientes todos os meses.',
  },
]

const VIDEO_EMOJI: Record<string, string> = {
  Onboarding: '🚀', Precificação: '💰', Produtos: '📦',
  Pedidos: '📋', Orçamentos: '📄', Estoque: '🗃️',
  Agenda: '📅', Financeiro: '💵',
}

const EBOOK_EMOJI: Record<string, string> = {
  Precificação: '💰', Financeiro: '💵', Produção: '🏭',
  Vendas: '🛍️', Produtividade: '⚡', Marketing: '📣',
}

/* ══════════════════════════════════════════
   PAGE
══════════════════════════════════════════ */
export default function ConteudoPage() {
  const [activeFilter, setActiveFilter] = useState<Category>('all')
  const [proModal,     setProModal]     = useState(false)
  const [selectedItem, setSelectedItem] = useState<Content | null>(null)

  /* Plano real via Stripe/Supabase */
  const { data: sub } = useSubscription()
  const isPro = sub?.isPro ?? false

  const filtered = CONTENTS.filter(c => {
    if (activeFilter === 'all')   return true
    if (activeFilter === 'video') return c.type === 'video'
    if (activeFilter === 'ebook') return c.type === 'ebook'
    return true
  })

  const videos = filtered.filter(c => c.type === 'video')
  const ebooks = filtered.filter(c => c.type === 'ebook')

  function handleOpen(item: Content) {
    if (item.isPro && !isPro) {
      setSelectedItem(item)
      setProModal(true)
      return
    }
    // Aqui viria a lógica de abrir vídeo/ebook (URL do conteúdo)
    // Por ora: placeholder
    alert(`Abrindo: ${item.title}`)
  }

  return (
    <div className="page-enter">
      <Header
        title="Central de Conteúdo"
        subtitle="Aprenda a usar o Precy+ e acesse materiais exclusivos para evoluir seu negócio"
      />

      <div className="p-3 sm:p-5 lg:p-6 space-y-6">

        {/* ── Banner PRO (para usuários Basic) ── */}
        {!isPro && (
          <div
            className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{
              background: 'linear-gradient(135deg, #2C2018 0%, #3A2D22 100%)',
              border: '1px solid rgba(139,108,79,0.4)',
              boxShadow: '0 0 40px rgba(139,108,79,0.1)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,108,79,0.2)' }}>
                <Crown size={18} style={{ color: '#C4A47B' }} />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-100">
                  Ebooks exclusivos no plano PRO
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Assine o PRO e acesse materiais premium de gestão, precificação e vendas
                </p>
              </div>
            </div>
            <button
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)' }}
            >
              Assinar PRO <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ── Filtros ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: 'all',   label: 'Todos',   count: CONTENTS.length  },
            { key: 'video', label: '▶ Vídeos', count: CONTENTS.filter(c=>c.type==='video').length },
            { key: 'ebook', label: '📖 Ebooks', count: CONTENTS.filter(c=>c.type==='ebook').length },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                activeFilter === f.key
                  ? 'border-primary bg-primary-50 dark:bg-primary/10 text-primary'
                  : 'border-border dark:border-border-dark text-text-secondary dark:text-stone-400 hover:border-primary/50'
              )}
            >
              {f.label}
              <span className={clsx(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                activeFilter === f.key
                  ? 'bg-primary/10 text-primary dark:bg-primary/20'
                  : 'bg-border dark:bg-border-dark text-text-muted'
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── VÍDEOS TUTORIAIS ── */}
        {(activeFilter === 'all' || activeFilter === 'video') && videos.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Play size={15} className="text-primary" />
              <h2 className="text-sm font-bold text-text-primary dark:text-stone-100">
                Vídeos tutoriais
              </h2>
              <span className="text-xs text-text-muted dark:text-stone-500">
                — disponíveis para todos os planos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {videos.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleOpen(item)}
                  className="group text-left card p-0 overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200"
                >
                  {/* Thumbnail placeholder */}
                  <div className="h-28 flex items-center justify-center relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #2C2018 0%, #1C1410 100%)' }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl opacity-30">
                        {VIDEO_EMOJI[item.category] ?? '📹'}
                      </span>
                    </div>
                    {/* Play button */}
                    <div className="relative z-10 w-11 h-11 rounded-full flex items-center justify-center border border-white/20 bg-white/10 backdrop-blur-sm group-hover:scale-105 group-hover:bg-white/20 transition-all">
                      <Play size={16} className="text-white ml-0.5" fill="white" />
                    </div>
                    {/* Duration badge */}
                    {item.duration && (
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-semibold text-white bg-black/40 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                        <Clock size={9} /> {item.duration}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary/10 text-primary">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-tight line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-text-muted dark:text-stone-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── EBOOKS PREMIUM ── */}
        {(activeFilter === 'all' || activeFilter === 'ebook') && ebooks.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-primary" />
              <h2 className="text-sm font-bold text-text-primary dark:text-stone-100">
                Biblioteca PRO
              </h2>
              <span className="text-xs text-text-muted dark:text-stone-500">
                — exclusivo assinantes PRO
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ebooks.map(item => {
                const locked = item.isPro && !isPro
                return (
                  <button
                    key={item.id}
                    onClick={() => handleOpen(item)}
                    className={clsx(
                      'group text-left card p-0 overflow-hidden transition-all duration-200 relative',
                      locked
                        ? 'hover:border-primary/40'
                        : 'hover:border-primary/40 hover:-translate-y-0.5'
                    )}
                  >
                    {/* Ebook cover */}
                    <div
                      className="h-20 flex items-center justify-between px-5 relative overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #1C1714, #2C2018)' }}
                    >
                      <span className="text-3xl z-10 relative">
                        {EBOOK_EMOJI[item.category] ?? '📖'}
                      </span>
                      <div className="text-right z-10 relative">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-stone-500 mb-0.5">
                          {item.category}
                        </p>
                        <div className="flex items-center gap-1 justify-end">
                          <BookOpen size={10} style={{ color: '#8B6C4F' }} />
                          <span className="text-[10px] font-semibold" style={{ color: '#8B6C4F' }}>
                            Ebook
                          </span>
                        </div>
                      </div>
                      {/* PRO badge */}
                      <div
                        className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', color: '#fff' }}
                      >
                        PRO
                      </div>
                    </div>

                    {/* Info */}
                    <div className={clsx('p-3.5 space-y-1.5', locked && 'opacity-70')}>
                      <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-tight line-clamp-2">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-text-muted dark:text-stone-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Lock overlay */}
                    {locked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex flex-col items-center gap-2 px-4 text-center">
                          <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                            <Lock size={16} className="text-white" />
                          </div>
                          <p className="text-[11px] font-semibold text-white">Exclusivo PRO</p>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* ── MODAL PRO ── */}
      {proModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setProModal(false)} />
          <div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden animate-scaleIn shadow-[0_32px_64px_rgba(0,0,0,0.5)]"
            style={{ background: 'linear-gradient(145deg, #2C2018, #1C1714)', border: '1px solid rgba(139,108,79,0.4)' }}
          >
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #8B6C4F, #C4A47B, #8B6C4F40)' }} />

            <div className="p-6 text-center">
              <button onClick={() => setProModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-stone-500 hover:text-stone-300 hover:bg-white/5 transition-colors">
                <X size={15} />
              </button>

              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(139,108,79,0.2)' }}>
                <Crown size={24} style={{ color: '#C4A47B' }} />
              </div>

              <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-2">
                Conteúdo Exclusivo
              </p>
              <h3 className="text-base font-bold text-stone-100 mb-1">
                Disponível no plano PRO
              </h3>
              <p className="text-sm text-stone-400 mb-1 px-2 leading-relaxed">
                &ldquo;{selectedItem.title}&rdquo;
              </p>
              <p className="text-xs text-stone-500 mb-6 px-4">
                Assine o PRO e acesse toda a biblioteca de ebooks, materiais premium e suporte prioritário.
              </p>

              <div className="space-y-2.5 px-2">
                <button
                  className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #8B6C4F, #B8956A)', boxShadow: '0 4px 20px rgba(139,108,79,0.4)' }}
                >
                  <Crown size={15} /> Desbloquear PRO — R$47/mês
                </button>
                <button
                  onClick={() => setProModal(false)}
                  className="w-full py-2.5 rounded-xl text-xs text-stone-500 hover:text-stone-400 transition-colors"
                >
                  Continuar no Basic
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
