'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  X, Upload, FileText, Loader2, CheckCircle2, AlertTriangle, ImageOff, ShieldAlert,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toaster'
import { extractCatalogPdfLayout } from '@/lib/pdf/extractCatalogPdfText'

interface PriceOption {
  label: string | null
  price: number
}

interface AnalyzedItem {
  tempId: string
  name: string | null
  category: string | null
  price: number | null
  priceOptions: PriceOption[]
  unit: string | null
  minQuantity: number | null
  description: string | null
  notes: string | null
  confidence: 'alta' | 'media' | 'baixa'
  needsReview: boolean
  reviewReasons: string[]
  sourcePage: number
  duplicateOf: { id: string; name: string } | null
}

type ItemAction = 'create' | 'update' | 'skip'

interface ReviewItem extends AnalyzedItem {
  action: ItemAction
}

type Step = 'upload' | 'analyzing' | 'review' | 'importing' | 'done'

interface Props {
  companyId: string
  onClose: () => void
}

function fmtBRL(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CONFIDENCE_LABEL: Record<AnalyzedItem['confidence'], string> = { alta: 'ALTA', media: 'MÉDIA', baixa: 'BAIXA' }
const CONFIDENCE_BADGE: Record<AnalyzedItem['confidence'], string> = {
  alta: 'badge-primary', media: 'badge-warning', baixa: 'badge-error',
}

// Uma seleção inicial nunca marca sozinho um item sem nome ou de confiança
// baixa — a pessoa revisa e decide, em vez de já vir tudo marcado "para não
// perceber" que 30 fragmentos duvidosos entraram junto (pedido explícito:
// nunca importar lixo sem querer).
function defaultAction(item: AnalyzedItem): ItemAction {
  if (!item.name || item.confidence === 'baixa') return 'skip'
  return item.duplicateOf ? 'update' : 'create'
}

export function ImportCatalogModal({ onClose }: Props) {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [step, setStep] = useState<Step>('upload')
  const [filename, setFilename] = useState<string>('')
  const [pageCount, setPageCount] = useState(0)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ imported: number; updated: number; skipped: number; errors: string[] } | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setFilename(file.name)
    setStep('analyzing')
    try {
      const layout = await extractCatalogPdfLayout(file)
      const res = await fetch('/api/produtos/importar-catalogo/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, pages: layout.pages }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Falha ao analisar o PDF')

      const reviewItems: ReviewItem[] = (body.items as AnalyzedItem[]).map(item => ({
        ...item,
        action: defaultAction(item),
      }))
      setItems(reviewItems)
      setPageCount(body.pageCount ?? layout.pageCount)
      setStep('review')
    } catch (err) {
      const e = err as Error
      setError(e.message)
      setStep('upload')
    }
  }

  function updateItem(tempId: string, patch: Partial<ReviewItem>) {
    setItems(prev => prev.map(i => (i.tempId === tempId ? { ...i, ...patch } : i)))
  }

  async function handleConfirm() {
    setStep('importing')
    try {
      const payload = items
        .filter(i => i.action !== 'skip' && i.name)
        .map(i => ({
          action: i.action,
          targetProductId: i.action === 'update' ? i.duplicateOf?.id : undefined,
          name: i.name,
          category: i.category,
          price: i.price,
          unit: i.unit,
          minQuantity: i.minQuantity,
          notes: i.description,
          needsReview: i.needsReview,
        }))

      const res = await fetch('/api/produtos/importar-catalogo/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, sourceLabel: 'PDF', items: payload }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Falha ao importar')

      setSummary({
        imported: body.imported ?? 0,
        updated: body.updated ?? 0,
        skipped: items.filter(i => i.action === 'skip').length,
        errors: body.errors ?? [],
      })
      qc.invalidateQueries({ queryKey: ['products'] })
      setStep('done')
    } catch (err) {
      const e = err as Error
      toast('error', `Erro ao importar: ${e.message}`)
      setStep('review')
    }
  }

  const selectedCount = items.filter(i => i.action !== 'skip').length
  const reviewCount = items.filter(i => i.needsReview).length
  const duplicateCount = items.filter(i => i.duplicateOf).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background dark:bg-background-dark w-full max-w-2xl max-h-[95dvh] sm:max-h-[92vh] flex flex-col rounded-2xl shadow-modal animate-scaleIn overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(139,108,79,0.07), rgba(184,149,106,0.04))' }}>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-text-primary dark:text-stone-100">Importar Catálogo</h2>
            <p className="text-xs text-text-muted mt-0.5">Envie um PDF de catálogo e revise os produtos antes de importar.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted flex-shrink-0 ml-2">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {step === 'upload' && (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border dark:border-border-dark rounded-2xl p-8 cursor-pointer hover:border-primary transition-colors">
                <Upload size={24} className="text-text-muted" />
                <span className="text-sm font-medium text-text-primary dark:text-stone-100">Clique para selecionar um PDF</span>
                <span className="text-xs text-text-muted">Catálogo com nome e preço por produto (ex: R$ 12,50)</span>
                <input type="file" accept="application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </label>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-error-light dark:bg-error/10 text-error-dark dark:text-error text-xs">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-text-secondary dark:text-stone-400">Lendo &quot;{filename}&quot; e identificando produtos...</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-primary-50/50 dark:bg-primary/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={14} className="text-primary flex-shrink-0" />
                  <span className="font-medium text-text-primary dark:text-stone-100 truncate">{filename}</span>
                </div>
                <p className="text-xs text-text-secondary dark:text-stone-400">
                  {pageCount} página{pageCount === 1 ? '' : 's'} analisada{pageCount === 1 ? '' : 's'} ·{' '}
                  {items.length} produto{items.length === 1 ? '' : 's'} identificado{items.length === 1 ? '' : 's'} ·{' '}
                  {reviewCount} item{reviewCount === 1 ? '' : 's'} precisa{reviewCount === 1 ? '' : 'm'} de revisão
                  {duplicateCount > 0 && <> · {duplicateCount} possível{duplicateCount === 1 ? '' : 'is'} duplicado{duplicateCount === 1 ? '' : 's'}</>}
                </p>
              </div>

              <div className="space-y-2">
                {items.map(item => {
                  const nameMissing = !item.name
                  return (
                    <div key={item.tempId} className={`rounded-xl border p-3 space-y-2 ${item.action === 'skip' ? 'opacity-60' : ''} ${item.confidence === 'baixa' ? 'border-error/30' : 'border-border dark:border-border-dark'}`}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" className="mt-1 flex-shrink-0" checked={item.action !== 'skip'} disabled={nameMissing}
                          onChange={e => updateItem(item.tempId, { action: e.target.checked ? (item.duplicateOf ? 'update' : 'create') : 'skip' })} />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input type="text" value={item.name ?? ''} placeholder="Nome não identificado — revise antes de importar"
                              onChange={e => updateItem(item.tempId, { name: e.target.value || null })}
                              className={`input text-sm py-1.5 flex-1 min-w-[140px] font-medium ${nameMissing ? 'border-error/50 placeholder:text-error-dark/60 dark:placeholder:text-error/60' : ''}`} />
                            <span className={`badge ${CONFIDENCE_BADGE[item.confidence]} text-[9px] flex-shrink-0`}>
                              Confiança {CONFIDENCE_LABEL[item.confidence]}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            <input type="text" value={item.category ?? ''} placeholder="Categoria"
                              onChange={e => updateItem(item.tempId, { category: e.target.value || null })}
                              className="input text-xs py-1.5" />
                            <input type="number" step="0.01" value={item.price ?? ''} placeholder="Preço"
                              onChange={e => updateItem(item.tempId, { price: e.target.value === '' ? null : Number(e.target.value) })}
                              className="input text-xs py-1.5" />
                            <input type="text" value={item.unit ?? ''} placeholder="Unidade"
                              onChange={e => updateItem(item.tempId, { unit: e.target.value || null })}
                              className="input text-xs py-1.5" />
                          </div>

                          {item.priceOptions.length > 1 && (
                            <div className="flex flex-wrap gap-1">
                              {item.priceOptions.map((opt, i) => (
                                <span key={i} className="badge badge-info text-[9px]">
                                  {opt.label ? `${opt.label}: ` : ''}{fmtBRL(opt.price)}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.description && (
                            <p className="text-[11px] text-text-secondary dark:text-stone-400 leading-snug line-clamp-2">{item.description}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.reviewReasons.map(r => (
                              <span key={r} className="badge badge-warning text-[9px] flex items-center gap-1">
                                <AlertTriangle size={9} /> {r}
                              </span>
                            ))}
                            <span className="badge badge-info text-[9px] flex items-center gap-1">
                              <ImageOff size={9} /> Imagem requer revisão
                            </span>
                            {item.minQuantity && (
                              <span className="badge badge-primary text-[9px]">Mín. {item.minQuantity}</span>
                            )}
                            <span className="text-[9px] text-text-muted">pág. {item.sourcePage}</span>
                          </div>

                          {item.duplicateOf && item.action !== 'skip' && (
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[10px] text-warning-dark dark:text-warning">
                                Possível produto existente: &quot;{item.duplicateOf.name}&quot;
                              </span>
                              <select value={item.action} onChange={e => updateItem(item.tempId, { action: e.target.value as ItemAction })}
                                className="input text-[10px] py-1 px-1.5 w-auto">
                                <option value="update">Atualizar existente</option>
                                <option value="create">Criar novo</option>
                                <option value="skip">Ignorar</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-text-secondary dark:text-stone-400">Importando produtos selecionados...</p>
            </div>
          )}

          {step === 'done' && summary && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 size={32} className="text-success" />
              <p className="text-sm font-semibold text-text-primary dark:text-stone-100">Importação concluída</p>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="badge badge-primary">{summary.imported} criado{summary.imported === 1 ? '' : 's'}</span>
                <span className="badge badge-info">{summary.updated} atualizado{summary.updated === 1 ? '' : 's'}</span>
                <span className="badge">{summary.skipped} ignorado{summary.skipped === 1 ? '' : 's'}</span>
              </div>
              {summary.errors.length > 0 && (
                <div className="text-left w-full mt-2 space-y-1">
                  {summary.errors.map((e, i) => (
                    <p key={i} className="text-xs text-error-dark dark:text-error">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'review' && (
          <div className="flex-shrink-0 border-t border-border dark:border-border-dark p-3 sm:p-4 space-y-2">
            {items.some(i => i.confidence === 'baixa' && i.action !== 'skip') && (
              <div className="flex items-center gap-1.5 text-[11px] text-error-dark dark:text-error">
                <ShieldAlert size={12} className="flex-shrink-0" />
                Há item(ns) de confiança baixa selecionado(s) — revise o nome antes de importar.
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <button onClick={onClose} className="text-sm text-text-muted hover:text-text-primary">Cancelar</button>
              <button onClick={handleConfirm} disabled={selectedCount === 0} className="btn-primary text-sm py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed">
                Importar {selectedCount} produto{selectedCount === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
        {step === 'done' && (
          <div className="flex-shrink-0 border-t border-border dark:border-border-dark p-3 sm:p-4 flex justify-end">
            <button onClick={onClose} className="btn-primary text-sm py-2 px-4">Concluir</button>
          </div>
        )}
      </div>
    </div>
  )
}
