'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Loader2, X, Sparkles, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { comboKey, generateValidCombos, type DependencyRow, type GroupRow } from '@/lib/catalog/variationCombos'

interface Props {
  productId: string
  companyId: string
  groups: GroupRow[]
  existingCombos: Set<string>
  onClose: () => void
  onGenerate: (combos: string[][]) => Promise<void>
  onOpenManualForm: () => void
}

/** parentGroupId escolhido + quais opções-pai habilitam cada opção deste grupo */
interface GroupConfig {
  parentGroupId: string
  checks: Record<string, Set<string>> // optionId -> Set<parentOptionId>
}

/**
 * Assistente "Gerenciar combinações": passo a passo por grupo (na ordem de
 * sort_order). O primeiro grupo é a raiz (sem configuração). Cada grupo
 * seguinte escolhe de qual grupo anterior depende (pode pular grupos — ex:
 * Acabamento pode depender de Gramatura, pulando Impressão) e marca, para
 * cada opção desse grupo-pai, quais opções deste grupo ficam habilitadas.
 * No passo final, gera só as combinações válidas resultantes (nunca apaga
 * combinações já existentes).
 */
export function VariationRulesWizard({ productId, companyId, groups, existingCombos, onClose, onGenerate, onOpenManualForm }: Props) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [stepIndex, setStepIndex] = useState(0)
  const [configs, setConfigs] = useState<Record<string, GroupConfig>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const depsQuery = useQuery<DependencyRow[]>({
    queryKey: ['product-variation-dependencies', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await (supabase.from('product_variation_dependencies') as any)
        .select('id, option_id, depends_on_option_id')
        .eq('product_id', productId)
      return data ?? []
    },
  })

  // Inicializa a config de cada grupo (>=1) a partir das dependências já salvas,
  // default de "depende de" = grupo imediatamente anterior.
  useEffect(() => {
    if (loaded || !depsQuery.data) return
    const next: Record<string, GroupConfig> = {}
    for (let i = 1; i < groups.length; i++) {
      const group = groups[i]
      const optionIds = new Set(group.options.map(o => o.id))
      const relevantDeps = depsQuery.data.filter(d => optionIds.has(d.option_id))
      // Descobre o grupo-pai a partir das dependências existentes (se houver);
      // senão usa o grupo imediatamente anterior.
      let parentGroupId = groups[i - 1].id
      if (relevantDeps.length > 0) {
        const parentOptionId = relevantDeps[0].depends_on_option_id
        const parentGroup = groups.slice(0, i).find(g => g.options.some(o => o.id === parentOptionId))
        if (parentGroup) parentGroupId = parentGroup.id
      }
      const checks: Record<string, Set<string>> = {}
      for (const d of relevantDeps) {
        if (!checks[d.option_id]) checks[d.option_id] = new Set()
        checks[d.option_id].add(d.depends_on_option_id)
      }
      next[group.id] = { parentGroupId, checks }
    }
    setConfigs(next)
    setLoaded(true)
  }, [loaded, depsQuery.data, groups])

  const isPreviewStep = stepIndex === groups.length
  const currentGroup = stepIndex > 0 && stepIndex < groups.length ? groups[stepIndex] : null
  const currentConfig = currentGroup ? configs[currentGroup.id] : null
  const parentGroup = currentConfig ? groups.find(g => g.id === currentConfig.parentGroupId) ?? null : null

  const allDeps = useMemo<DependencyRow[]>(() => {
    const rows: DependencyRow[] = []
    for (const g of groups.slice(1)) {
      const cfg = configs[g.id]
      if (!cfg) continue
      for (const [optionId, parents] of Object.entries(cfg.checks)) {
        for (const p of parents) rows.push({ option_id: optionId, depends_on_option_id: p })
      }
    }
    return rows
  }, [configs, groups])

  const preview = useMemo(() => {
    if (!isPreviewStep) return []
    return generateValidCombos(groups, allDeps)
  }, [isPreviewStep, groups, allDeps])

  const newCombos = preview.filter(c => !existingCombos.has(comboKey(c)))

  function toggleCheck(optionId: string, parentOptionId: string) {
    if (!currentGroup) return
    setConfigs(prev => {
      const cfg = prev[currentGroup.id] ?? { parentGroupId: parentGroup?.id ?? '', checks: {} }
      const current = new Set(cfg.checks[optionId] ?? [])
      if (current.has(parentOptionId)) current.delete(parentOptionId)
      else current.add(parentOptionId)
      return { ...prev, [currentGroup.id]: { ...cfg, checks: { ...cfg.checks, [optionId]: current } } }
    })
  }

  function setParentGroup(groupId: string) {
    if (!currentGroup) return
    setConfigs(prev => ({ ...prev, [currentGroup.id]: { parentGroupId: groupId, checks: {} } }))
  }

  async function saveCurrentStep() {
    if (!currentGroup) return true
    setSaving(true)
    try {
      const cfg = configs[currentGroup.id]
      const optionIds = currentGroup.options.map(o => o.id)
      // Substitui por completo as regras deste grupo (evita sobras ao trocar o "depende de").
      await (supabase.from('product_variation_dependencies') as any).delete().in('option_id', optionIds)
      const rows: { product_id: string; company_id: string; option_id: string; depends_on_option_id: string }[] = []
      for (const [optionId, parents] of Object.entries(cfg?.checks ?? {})) {
        for (const p of parents) {
          rows.push({ product_id: productId, company_id: companyId, option_id: optionId, depends_on_option_id: p })
        }
      }
      if (rows.length > 0) {
        const { error } = await (supabase.from('product_variation_dependencies') as any).insert(rows)
        if (error) throw error
      }
      qc.invalidateQueries({ queryKey: ['product-variation-dependencies', productId] })
      return true
    } catch (err) {
      console.error('[variation-wizard] erro ao salvar dependências:', err)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleNext() {
    const ok = await saveCurrentStep()
    if (ok) setStepIndex(i => i + 1)
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      await onGenerate(newCombos.filter(c => !excluded.has(comboKey(c))))
    } finally {
      setGenerating(false)
    }
  }

  function optionLabel(id: string): string {
    for (const g of groups) {
      const o = g.options.find(o => o.id === id)
      if (o) return o.value
    }
    return '—'
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-h-[90vh] flex flex-col overflow-hidden"
        style={{ width: 'min(900px, 90vw)' }}
      >
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
          <h2 className="text-sm sm:text-base font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-primary flex-shrink-0" /> <span className="truncate">Gerenciar combinações</span>
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onOpenManualForm}
              className="btn-secondary text-xs sm:text-sm py-1.5 px-3 flex items-center gap-1.5"
              title="Criar uma combinação manual, sem depender do gerador automático"
            >
              <Plus size={14} /> <span className="hidden sm:inline">Nova combinação</span>
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {!loaded ? (
            <div className="flex items-center gap-2 text-xs text-text-muted py-6 justify-center">
              <Loader2 size={14} className="animate-spin" /> Carregando...
            </div>
          ) : stepIndex === 0 ? (
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-text-muted dark:text-stone-500">
                Grupo inicial — todas as opções abaixo estão disponíveis como ponto de partida.
                Para adicionar ou remover, use a lista de grupos/opções.
              </p>
              <div className="rounded-xl border border-border dark:border-border-dark p-4">
                <p className="text-xs font-medium text-text-muted dark:text-stone-500 mb-2">Grupo base</p>
                <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">{groups[0]?.name}</p>
                <div className="flex flex-wrap gap-2">
                  {groups[0]?.options.map(o => (
                    <span key={o.id} className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary/10 text-primary">
                      {o.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : currentGroup && currentConfig ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border dark:border-border-dark p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-text-muted dark:text-stone-500">Configurando o grupo</p>
                  <p className="text-base font-semibold text-text-primary dark:text-stone-100">{currentGroup.name}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-primary dark:text-stone-200 mb-1.5">
                    Escolha o grupo pai
                  </label>
                  <select
                    value={currentConfig.parentGroupId}
                    onChange={e => setParentGroup(e.target.value)}
                    className="input text-sm w-full"
                  >
                    {groups.slice(0, stepIndex).map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
              >
                {parentGroup?.options.map(parentOption => (
                  <div key={parentOption.id} className="rounded-xl border border-border dark:border-border-dark p-4">
                    <p className="text-sm font-semibold text-text-primary dark:text-stone-100 mb-3">{parentOption.value}</p>
                    <div className="space-y-2">
                      {currentGroup.options.map(opt => (
                        <label key={opt.id} className="flex items-center gap-2.5 text-sm text-text-secondary dark:text-stone-300">
                          <input
                            type="checkbox"
                            checked={currentConfig.checks[opt.id]?.has(parentOption.id) ?? false}
                            onChange={() => toggleCheck(opt.id, parentOption.id)}
                            className="w-4 h-4 rounded accent-primary flex-shrink-0"
                          />
                          {opt.value}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : isPreviewStep ? (
            <div className="space-y-3">
              {newCombos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border dark:border-border-dark p-5 text-center space-y-3">
                  <p className="text-sm font-medium text-text-primary dark:text-stone-100">
                    Todas as combinações automáticas já foram criadas.
                  </p>
                  <p className="text-xs sm:text-sm text-text-muted dark:text-stone-500">
                    Você ainda pode adicionar combinações manuais clicando em &ldquo;Nova combinação&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenManualForm}
                    className="btn-secondary text-xs sm:text-sm py-2 px-4 inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Nova combinação
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs sm:text-sm text-text-muted dark:text-stone-500">
                    {`${newCombos.length} combinação(ões) nova(s) serão criadas. Desmarque as que não quiser gerar.`}
                  </p>
                  <div
                    className="grid gap-2.5"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
                  >
                    {newCombos.map(combo => {
                      const key = comboKey(combo)
                      return (
                        <label key={key} className="flex items-center gap-2.5 text-sm p-3 rounded-xl border border-border dark:border-border-dark">
                          <input
                            type="checkbox"
                            checked={!excluded.has(key)}
                            onChange={() => setExcluded(prev => {
                              const next = new Set(prev)
                              if (next.has(key)) next.delete(key); else next.add(key)
                              return next
                            })}
                            className="w-4 h-4 rounded accent-primary flex-shrink-0"
                          />
                          <span className="min-w-0 break-words">{combo.map(optionLabel).join(' · ')}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
          <button
            type="button"
            disabled={stepIndex === 0 || saving || generating}
            onClick={() => setStepIndex(i => i - 1)}
            className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-4 flex items-center gap-1.5 disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Voltar
          </button>
          {isPreviewStep ? (
            <button
              type="button"
              disabled={generating || newCombos.length === 0}
              onClick={handleGenerate}
              className="btn-primary text-xs sm:text-sm py-2 px-4 sm:px-5 flex items-center gap-1.5 disabled:opacity-50"
            >
              {generating && <Loader2 size={14} className="animate-spin" />} Gerar combinações
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || groups.length === 0}
              onClick={handleNext}
              className="btn-primary text-xs sm:text-sm py-2 px-4 sm:px-5 flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />} Avançar <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
