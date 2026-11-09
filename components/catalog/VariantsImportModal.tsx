'use client'

import { useRef, useState } from 'react'
import { X, Upload, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import { clsx } from 'clsx'
import { useToast } from '@/components/ui/Toaster'
import { formatCurrency } from '@/lib/utils/format'
import type { ImportPreviewUpdate, ImportPreviewInvalidRow, ImportFieldChange } from '@/app/api/produtos/variacoes/importar/analisar/route'

interface Props {
  productId: string
  onClose: () => void
  /** Chamado após a importação ser confirmada com sucesso, pra recarregar a tabela de combinações. */
  onImported: () => void
}

interface PreviewData {
  productName: string
  totalFound: number
  toUpdateCount: number
  unchangedCount: number
  invalidCount: number
  updates: ImportPreviewUpdate[]
  invalidRows: ImportPreviewInvalidRow[]
}

type Step = 'pick' | 'analyzing' | 'preview' | 'confirming'

function fieldDisplay(c: ImportFieldChange, which: 'current' | 'next'): string {
  const v = which === 'current' ? c.current : c.next
  if (c.field === 'price') return v === '—' ? v : formatCurrency(Number(v))
  return v
}

/**
 * Modal de importação de preços por planilha Excel (Produtos → Variações →
 * "Importar Excel"). Fluxo em 2 chamadas ao servidor: .../analisar (só
 * leitura, monta a prévia) e .../confirmar (grava, de forma transacional —
 * ver migration 089). Nada é salvo antes da pessoa confirmar a prévia.
 */
export function VariantsImportModal({ productId, onClose, onImported }: Props) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFilePicked(file: File | undefined) {
    if (!file) return
    setError(null)
    setFileName(file.name)
    setStep('analyzing')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('productId', productId)
      const res = await fetch('/api/produtos/variacoes/importar/analisar', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Não foi possível ler a planilha.')
        setStep('pick')
        return
      }
      setPreview(data)
      setStep('preview')
    } catch {
      setError('Erro de conexão ao enviar a planilha. Tente novamente.')
      setStep('pick')
    }
  }

  async function handleConfirm() {
    if (!preview || preview.updates.length === 0) return
    setStep('confirming')
    setError(null)
    try {
      const res = await fetch('/api/produtos/variacoes/importar/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          updates: preview.updates.map(u => {
            const patch: Record<string, unknown> = { id: u.id }
            for (const c of u.changes) {
              if (c.field === 'price') patch.price = Number(c.next.replace(',', '.'))
              else if (c.field === 'status') patch.is_active = c.next === 'Ativa'
              else if (c.field === 'sku') patch.sku = c.next === '—' ? null : c.next
              else if (c.field === 'stock_quantity') patch.stock_quantity = c.next === '—' ? null : Number(c.next)
              else if (c.field === 'lead_time_days') patch.lead_time_days = c.next === '—' ? null : Number(c.next)
              else if (c.field === 'weight_kg') patch.weight_kg = c.next === '—' ? null : Number(c.next)
            }
            return patch
          }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Não foi possível salvar as alterações. Nenhum preço foi atualizado.')
        setStep('preview')
        return
      }
      toast('success', `${data.updatedCount} combinação(ões) atualizada(s) com sucesso!`)
      onImported()
      onClose()
    } catch {
      setError('Erro de conexão ao confirmar a importação. Nenhuma alteração foi aplicada. Tente novamente.')
      setStep('preview')
    }
  }

  function reset() {
    setStep('pick')
    setPreview(null)
    setFileName(null)
    setError(null)
  }

  const busy = step === 'analyzing' || step === 'confirming'

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div
        className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden"
        style={{ width: 'min(880px, 95vw)' }}
      >
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-border dark:border-border-dark flex-shrink-0">
          <h2 className="text-sm sm:text-base font-semibold text-text-primary dark:text-stone-100 flex items-center gap-2 min-w-0">
            <FileSpreadsheet size={16} className="text-primary flex-shrink-0" /> <span className="truncate">Importar Excel</span>
          </h2>
          <button onClick={() => !busy && onClose()} disabled={busy} className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-white/5 text-text-muted disabled:opacity-40 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-8 sm:pb-10 space-y-4">
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-error dark:text-red-400 bg-error-light dark:bg-error/10 rounded-xl p-3">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {error}
            </p>
          )}

          {(step === 'pick' || step === 'analyzing') && (
            <div className="rounded-xl border-2 border-dashed border-border dark:border-border-dark p-6 sm:p-8 text-center space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={e => { handleFilePicked(e.target.files?.[0]); e.target.value = '' }}
              />
              {step === 'analyzing' ? (
                <>
                  <Loader2 size={28} className="animate-spin text-primary mx-auto" />
                  <p className="text-sm text-text-secondary dark:text-stone-300">Lendo &ldquo;{fileName}&rdquo;…</p>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-text-muted mx-auto" />
                  <p className="text-sm text-text-secondary dark:text-stone-300">
                    Selecione a planilha .xlsx exportada pelo Precy+, já com as colunas destacadas em amarelo editadas (status, SKU, estoque, prazo, peso e/ou novo preço-base).
                  </p>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-1.5">
                    <Upload size={14} /> Escolher arquivo
                  </button>
                </>
              )}
            </div>
          )}

          {(step === 'preview' || step === 'confirming') && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Combinações encontradas', value: preview.totalFound, color: 'text-text-primary dark:text-stone-100' },
                  { label: 'Combinações serão atualizadas', value: preview.toUpdateCount, color: 'text-success-dark dark:text-success' },
                  { label: 'Sem alteração', value: preview.unchangedCount, color: 'text-text-secondary dark:text-stone-300' },
                  { label: 'Linhas inválidas', value: preview.invalidCount, color: preview.invalidCount > 0 ? 'text-error dark:text-red-400' : 'text-text-secondary dark:text-stone-300' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-2.5 bg-primary-50/50 dark:bg-primary/5">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 leading-tight">{s.label}</p>
                    <p className={clsx('text-lg font-bold', s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>

              {preview.toUpdateCount === 0 && preview.invalidCount === 0 && (
                <p className="text-xs text-text-muted dark:text-stone-500 text-center py-3">
                  Nenhuma célula editável foi alterada nesta planilha — nada será modificado.
                </p>
              )}

              {preview.updates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-primary dark:text-stone-100 mb-2">Alterações que serão aplicadas</p>
                  {/* Desktop: tabela */}
                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-border dark:border-border-dark">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border dark:border-border-dark bg-surface dark:bg-white/5">
                          {['Combinação', 'Campo', 'Valor atual', 'Novo valor'].map(h => (
                            <th key={h} className="text-left font-semibold text-text-muted uppercase tracking-wider p-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.updates.flatMap(u => u.changes.map((c, i) => (
                          <tr key={`${u.id}-${c.field}`} className="border-b border-border dark:border-border-dark last:border-0">
                            {i === 0 && (
                              <td className="p-2 text-text-primary dark:text-stone-200 align-top" rowSpan={u.changes.length}>{u.label}</td>
                            )}
                            <td className="p-2 text-text-secondary dark:text-stone-400">{c.label}</td>
                            <td className="p-2 text-text-secondary dark:text-stone-400">{fieldDisplay(c, 'current')}</td>
                            <td className="p-2 font-medium text-primary">{fieldDisplay(c, 'next')}</td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile: cartões */}
                  <div className="sm:hidden space-y-2">
                    {preview.updates.map(u => (
                      <div key={u.id} className="rounded-xl border border-border dark:border-border-dark p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-text-primary dark:text-stone-100 break-words">{u.label}</p>
                        {u.changes.map(c => (
                          <div key={c.field} className="flex items-center justify-between text-xs gap-2">
                            <span className="text-text-muted flex-shrink-0">{c.label}</span>
                            <span className="text-text-secondary dark:text-stone-400 truncate">{fieldDisplay(c, 'current')}</span>
                            <span className="font-medium text-primary flex-shrink-0">→ {fieldDisplay(c, 'next')}</span>
                          </div>
                        ))}
                        {u.finalPrice != null && (
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-border dark:border-border-dark">
                            <span className="text-text-muted">Preço final calculado</span>
                            <span className="font-semibold text-text-primary dark:text-stone-100">{formatCurrency(u.finalPrice)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.invalidRows.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-error dark:text-red-400 mb-2">
                    <AlertCircle size={13} /> Linhas que não serão aplicadas (corrija e importe de novo, se necessário)
                  </p>
                  <div className="space-y-1.5">
                    {preview.invalidRows.map((r, i) => (
                      <p key={i} className="text-[11px] text-text-secondary dark:text-stone-400 bg-error-light dark:bg-error/10 rounded-lg px-2.5 py-1.5">
                        Linha {r.row} (ID {r.id.slice(0, 8)}…): {r.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" onClick={reset} disabled={busy} className="text-xs font-medium text-primary hover:underline disabled:opacity-40">
                Escolher outro arquivo
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 sm:p-5 border-t border-border dark:border-border-dark flex-shrink-0">
          <button type="button" onClick={() => !busy && onClose()} disabled={busy} className="btn-secondary flex-1 text-sm py-2.5 disabled:opacity-40">
            Cancelar
          </button>
          {step === 'preview' || step === 'confirming' ? (
            <button
              type="button"
              disabled={!preview || preview.toUpdateCount === 0 || step === 'confirming'}
              onClick={handleConfirm}
              className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {step === 'confirming' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {step === 'confirming' ? 'Importando...' : `Confirmar importação (${preview?.toUpdateCount ?? 0})`}
            </button>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    </div>
  )
}
