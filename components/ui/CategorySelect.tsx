'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyId } from '@/hooks/useCompanyId'
import { ChevronDown, Plus, Search, Check, Tag, Loader2, X } from 'lucide-react'
import { clsx } from 'clsx'

/* ─── Categorias padrão do sistema ─── */
export const PRODUCT_PRESET_CATEGORIES = [
  'Banner', 'Adesivo', 'Papelaria', 'Caneca', 'Copo', 'Quadro',
  'Vela', 'Cosmético', 'Roupa', 'Camiseta', 'Acessório',
  'Embalagem', 'Kit', 'Brindes', 'Personalizado', 'Outro',
]

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CategorySelect({
  value,
  onChange,
  placeholder = 'Selecione ou crie uma categoria',
  className,
  disabled,
}: CategorySelectProps) {
  const supabase    = createClient()
  const qc          = useQueryClient()
  const { companyId } = useCompanyId()

  const [open,       setOpen]       = useState(false)
  const [search,     setSearch]     = useState('')
  const [creating,   setCreating]   = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  /* ── Fechar ao clicar fora ── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  /* ── Focar input quando abre ── */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  /* ── Carregar categorias do Supabase ── */
  const { data: savedCategories = [] } = useQuery<string[]>({
    queryKey: ['product-categories', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('product_categories') as any)
        .select('name')
        .eq('company_id', companyId!)
        .order('name')
      return (data ?? []).map((r: any) => r.name as string)
    },
  })

  /* ── Criar nova categoria ── */
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await (supabase.from('product_categories') as any)
        .insert([{ company_id: companyId!, name }])
        .select()
      if (error && !error.message.includes('duplicate')) throw error
    },
    onSuccess: (_data, name) => {
      qc.invalidateQueries({ queryKey: ['product-categories', companyId] })
      onChange(name)
      setOpen(false)
      setSearch('')
      setCreating(false)
    },
    onError: () => setCreating(false),
  })

  /* ── Lista de opções filtradas ── */
  const allCategories = Array.from(new Set([
    ...PRODUCT_PRESET_CATEGORIES,
    ...savedCategories,
  ])).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const q = search.trim().toLowerCase()
  const filtered = allCategories.filter(c =>
    c.toLowerCase().includes(q)
  )

  /* Verifica se o termo digitado não existe ainda */
  const termIsNew = q.length >= 2 &&
    !allCategories.some(c => c.toLowerCase() === q)

  /* ── Selecionar categoria existente ── */
  const handleSelect = useCallback((cat: string) => {
    onChange(cat)
    setOpen(false)
    setSearch('')
    // Se for customizada, salvar no banco também
    const isPreset = PRODUCT_PRESET_CATEGORIES.some(p => p === cat)
    const isAlreadySaved = savedCategories.includes(cat)
    if (!isPreset && !isAlreadySaved && companyId) {
      createMutation.mutate(cat)
    }
  }, [onChange, savedCategories, companyId, createMutation])

  /* ── Criar nova ── */
  async function handleCreate() {
    const name = search.trim()
    if (!name || !companyId) return
    setCreating(true)
    createMutation.mutate(name)
  }

  /* ── Label exibido ── */
  const displayValue = value
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : ''

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* ── Trigger ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'input w-full flex items-center justify-between gap-2 text-left cursor-pointer',
          'transition-all duration-200',
          open && 'ring-2 ring-primary/40 border-primary',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Tag size={13} className={clsx('flex-shrink-0', value ? 'text-primary' : 'text-text-muted')} />
          <span className={clsx(
            'truncate text-sm',
            value ? 'text-text-primary dark:text-stone-100' : 'text-text-muted dark:text-stone-500'
          )}>
            {displayValue || placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {value && (
            <span
              onClick={e => { e.stopPropagation(); onChange('') }}
              className="p-0.5 rounded hover:bg-primary-50 dark:hover:bg-white/10 text-text-muted hover:text-primary transition-colors cursor-pointer"
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={clsx('text-text-muted transition-transform duration-200', open && 'rotate-180')}
          />
        </div>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className={clsx(
          'absolute z-50 left-0 right-0 mt-1.5',
          'bg-white dark:bg-surface-dark',
          'border border-border dark:border-border-dark',
          'rounded-2xl shadow-modal overflow-hidden',
          'animate-scaleIn origin-top',
        )}>
          {/* Search */}
          <div className="p-2.5 border-b border-border dark:border-border-dark">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (termIsNew) handleCreate()
                    else if (filtered.length > 0) handleSelect(filtered[0])
                  }
                  if (e.key === 'Escape') { setOpen(false); setSearch('') }
                }}
                placeholder="Buscar ou criar categoria..."
                className={clsx(
                  'w-full pl-8 pr-3 py-2 text-sm rounded-xl outline-none',
                  'bg-primary-50/40 dark:bg-white/5',
                  'border border-transparent focus:border-primary/40',
                  'text-text-primary dark:text-stone-100 placeholder:text-text-muted',
                  'transition-all duration-150',
                )}
              />
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">

            {/* Opção "criar nova" */}
            {termIsNew && (
              <button
                type="button"
                disabled={creating}
                onClick={handleCreate}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left',
                  'text-sm font-medium',
                  'bg-primary/8 dark:bg-primary/15 border border-primary/20',
                  'text-primary hover:bg-primary/15 dark:hover:bg-primary/25',
                  'transition-all duration-150',
                  'mb-1',
                )}
              >
                {creating
                  ? <Loader2 size={14} className="animate-spin flex-shrink-0" />
                  : <Plus size={14} className="flex-shrink-0" />
                }
                <span className="truncate">
                  {creating ? 'Criando...' : (
                    <>Criar <strong>&ldquo;{search.trim()}&rdquo;</strong></>
                  )}
                </span>
              </button>
            )}

            {/* Categorias filtradas */}
            {filtered.length > 0 ? (
              <>
                {/* Labels de grupo */}
                {savedCategories.length > 0 && !q && (
                  <p className="px-3 py-1 text-[10px] font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">
                    Suas categorias
                  </p>
                )}
                {savedCategories.filter(c =>
                  !q || c.toLowerCase().includes(q)
                ).map(cat => (
                  <CategoryOption
                    key={`saved-${cat}`}
                    label={cat}
                    selected={value === cat}
                    custom
                    onSelect={() => handleSelect(cat)}
                  />
                ))}

                {savedCategories.length > 0 && !q && (
                  <p className="px-3 py-1 mt-1 text-[10px] font-semibold text-text-muted dark:text-stone-500 uppercase tracking-wider">
                    Categorias padrão
                  </p>
                )}
                {filtered
                  .filter(c => savedCategories.includes(c)
                    ? false  // já mostrado acima
                    : true
                  )
                  .map(cat => (
                    <CategoryOption
                      key={`preset-${cat}`}
                      label={cat}
                      selected={value === cat}
                      onSelect={() => handleSelect(cat)}
                    />
                  ))
                }
              </>
            ) : !termIsNew ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Tag size={20} className="text-text-muted mb-2" />
                <p className="text-xs text-text-muted dark:text-stone-400">Nenhuma categoria encontrada</p>
                <p className="text-[10px] text-text-muted dark:text-stone-500 mt-0.5">
                  Continue digitando para criar uma nova
                </p>
              </div>
            ) : null}
          </div>

          {/* Dica */}
          <div className="px-3 py-2 border-t border-border dark:border-border-dark bg-primary-50/30 dark:bg-white/[0.02]">
            <p className="text-[10px] text-text-muted dark:text-stone-500 flex items-center gap-1">
              <span className="font-mono bg-primary-50 dark:bg-white/10 px-1 rounded text-primary">Enter</span>
              para selecionar · Digite para filtrar ou criar
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Item da lista ─── */
function CategoryOption({
  label, selected, custom, onSelect,
}: {
  label: string
  selected: boolean
  custom?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-100',
        selected
          ? 'bg-primary/10 dark:bg-primary/20 text-primary'
          : 'text-text-secondary dark:text-stone-300 hover:bg-primary-50/60 dark:hover:bg-white/[0.05] hover:text-text-primary dark:hover:text-stone-100',
      )}
    >
      <div className={clsx(
        'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border transition-all',
        selected
          ? 'bg-primary border-primary'
          : 'border-border dark:border-stone-600',
      )}>
        {selected && <Check size={9} strokeWidth={3} className="text-white" />}
      </div>
      <span className="text-sm truncate flex-1">
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </span>
      {custom && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary/15 text-primary flex-shrink-0">
          minha
        </span>
      )}
    </button>
  )
}
