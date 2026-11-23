'use client'

/**
 * Seção opcional de "Detalhes fiscais adicionais" da NF-e, reaproveitada
 * tanto na emissão por pedido quanto na nota avulsa.
 *
 * Campos aqui cobrem só o que foi CONFIRMADO como aceito de verdade pelo
 * schema oficial do Bling (NotasFiscaisDadosPostDTO, developer.bling.com.br,
 * verificado em 2026-11-23 direto no openapi.json da referência):
 * finalidade (+ tipoNota quando finalidade é Crédito/Débito), observações,
 * seguro, despesas, desconto e parcelas de pagamento (data/valor/observação).
 *
 * De propósito, NÃO inclui campos que a tela do Bling mostra mas a API não
 * aceita (série, vendedor, consumidor final, unidade de negócio, indicador
 * de presença, código do regime tributário, categoria financeira da
 * parcela) nem os blocos de transportador/volumes e intermediador — ver
 * lib/notasFiscais/fieldMapping.ts para o mapeamento completo do que existe
 * vs. não existe na API.
 */

import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export type Finalidade = 1 | 2 | 3 | 4 | 5 | 6

export interface ParcelaInput {
  tempId: string
  data: string
  valor: string
  observacoes: string
}

export interface NfeExtrasState {
  finalidade: Finalidade
  tipoNota: string
  observacoes: string
  seguro: string
  despesas: string
  desconto: string
  parcelas: ParcelaInput[]
}

export function criarNfeExtrasPadrao(): NfeExtrasState {
  return {
    finalidade: 1,
    tipoNota: '',
    observacoes: '',
    seguro: '',
    despesas: '',
    desconto: '',
    parcelas: [],
  }
}

/** Converte o estado do formulário no formato que `buildNfePayload` espera em `extras`. */
export function extrasParaPayload(state: NfeExtrasState) {
  const parcelasValidas = state.parcelas.filter(p => p.data && Number(p.valor) > 0)
  return {
    finalidade: state.finalidade,
    tipoNota: (state.finalidade === 5 || state.finalidade === 6) && state.tipoNota ? state.tipoNota : undefined,
    observacoes: state.observacoes.trim() || undefined,
    seguro: state.seguro !== '' ? Number(state.seguro) : undefined,
    despesas: state.despesas !== '' ? Number(state.despesas) : undefined,
    desconto: state.desconto !== '' ? Number(state.desconto) : undefined,
    parcelas: parcelasValidas.length > 0
      ? parcelasValidas.map(p => ({
          data: p.data,
          valor: Number(p.valor),
          observacoes: p.observacoes.trim() || undefined,
        }))
      : undefined,
  }
}

const FINALIDADES: { value: Finalidade; label: string }[] = [
  { value: 1, label: 'Normal' },
  { value: 2, label: 'Complementar' },
  { value: 3, label: 'Ajuste' },
  { value: 4, label: 'Devolução' },
  { value: 5, label: 'Crédito' },
  { value: 6, label: 'Débito' },
]

const TIPO_NOTA_CREDITO = [
  { value: '01', label: '01 — Multa e juros' },
  { value: '02', label: '02 — Apropriação de crédito presumido de IBS sobre saldo devedor na ZFM' },
  { value: '03', label: '03 — Retorno' },
  { value: '04', label: '04 — Redução de valores' },
  { value: '05', label: '05 — Transferência de crédito na sucessão' },
  { value: '06', label: '06 — Retorno por recusa parcial na entrega' },
]

const TIPO_NOTA_DEBITO = [
  { value: '01', label: '01 — Transferência de créditos para Cooperativas' },
  { value: '02', label: '02 — Anulação de Crédito por Saídas Imunes/Isentas' },
  { value: '03', label: '03 — Débitos de notas fiscais não processadas na apuração' },
  { value: '04', label: '04 — Multa e juros' },
  { value: '05', label: '05 — Transferência de crédito de sucessão' },
  { value: '06', label: '06 — Pagamento antecipado' },
  { value: '07', label: '07 — Perda em estoque' },
  { value: '08', label: '08 — Desenquadramento do Simples Nacional' },
]

function uid() {
  return Math.random().toString(36).slice(2)
}

export function NotaFiscalExtrasForm({
  value,
  onChange,
}: {
  value: NfeExtrasState
  onChange: (next: NfeExtrasState) => void
}) {
  const [open, setOpen] = useState(false)

  function patch(p: Partial<NfeExtrasState>) {
    onChange({ ...value, ...p })
  }

  function addParcela() {
    patch({ parcelas: [...value.parcelas, { tempId: uid(), data: '', valor: '', observacoes: '' }] })
  }

  function updateParcela(tempId: string, p: Partial<ParcelaInput>) {
    patch({ parcelas: value.parcelas.map(pa => (pa.tempId === tempId ? { ...pa, ...p } : pa)) })
  }

  function removeParcela(tempId: string) {
    patch({ parcelas: value.parcelas.filter(pa => pa.tempId !== tempId) })
  }

  const tipoNotaOptions = value.finalidade === 5 ? TIPO_NOTA_CREDITO : value.finalidade === 6 ? TIPO_NOTA_DEBITO : []

  return (
    <div className="card p-5 space-y-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="text-left">
          <h3 className="text-sm font-semibold text-text-primary dark:text-stone-100">Detalhes fiscais adicionais</h3>
          <p className="text-[11px] text-text-muted mt-0.5">Opcional — finalidade, observações, seguro/despesas/desconto e parcelas de pagamento</p>
        </div>
        {open ? <ChevronUp size={16} className="text-text-muted flex-shrink-0" /> : <ChevronDown size={16} className="text-text-muted flex-shrink-0" />}
      </button>

      {open && (
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Finalidade da nota</label>
              <select
                className="input w-full"
                value={value.finalidade}
                onChange={e => patch({ finalidade: Number(e.target.value) as Finalidade, tipoNota: '' })}
              >
                {FINALIDADES.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {tipoNotaOptions.length > 0 && (
              <div>
                <label className="text-xs text-text-muted mb-1 block">Tipo da nota ({value.finalidade === 5 ? 'Crédito' : 'Débito'})</label>
                <select
                  className="input w-full"
                  value={value.tipoNota}
                  onChange={e => patch({ tipoNota: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {tipoNotaOptions.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Observações da nota</label>
            <textarea
              className="input w-full"
              rows={2}
              value={value.observacoes}
              onChange={e => patch({ observacoes: e.target.value })}
              placeholder="Texto livre que aparece na nota fiscal"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Seguro (R$)</label>
              <input type="number" min={0} step="0.01" className="input w-full" value={value.seguro} onChange={e => patch({ seguro: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Outras despesas (R$)</label>
              <input type="number" min={0} step="0.01" className="input w-full" value={value.despesas} onChange={e => patch({ despesas: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Desconto (R$)</label>
              <input type="number" min={0} step="0.01" className="input w-full" value={value.desconto} onChange={e => patch({ desconto: e.target.value })} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-text-muted block">Parcelas de pagamento</label>
              <button type="button" onClick={addParcela} className="btn-secondary text-xs flex items-center gap-1.5">
                <Plus size={12} /> Adicionar parcela
              </button>
            </div>
            {value.parcelas.length === 0 ? (
              <p className="text-[11px] text-text-muted">Nenhuma parcela informada — opcional.</p>
            ) : (
              <div className="space-y-2">
                {value.parcelas.map((p, idx) => (
                  <div key={p.tempId} className="rounded-xl border border-border dark:border-border-dark p-3 grid grid-cols-1 sm:grid-cols-[auto_auto_1fr_auto] gap-2 items-end">
                    <div className="w-36">
                      <label className="text-[11px] text-text-muted block mb-1">Vencimento</label>
                      <input type="date" className="input w-full" value={p.data} onChange={e => updateParcela(p.tempId, { data: e.target.value })} />
                    </div>
                    <div className="w-28">
                      <label className="text-[11px] text-text-muted block mb-1">Valor</label>
                      <input type="number" min={0} step="0.01" className="input w-full" value={p.valor} onChange={e => updateParcela(p.tempId, { valor: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] text-text-muted block mb-1">Observação ({idx + 1}ª parcela)</label>
                      <input type="text" className="input w-full" value={p.observacoes} onChange={e => updateParcela(p.tempId, { observacoes: e.target.value })} />
                    </div>
                    <button type="button" onClick={() => removeParcela(p.tempId)} className="p-2 rounded-lg text-text-muted hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-error">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
