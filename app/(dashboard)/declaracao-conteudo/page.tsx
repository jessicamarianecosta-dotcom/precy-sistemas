'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useCompanyId } from '@/hooks/useCompanyId'
import { Header } from '@/components/layout/Header'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils/format'
import { printContentDeclaration, type DeclarationDocumentData } from '@/lib/pdf/contentDeclarationDocument'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  FileStack, Plus, Search, Eye, Trash2, Copy, Printer, Loader2,
} from 'lucide-react'

interface DeclarationRow {
  id: string
  recipient_name: string
  declaration_city: string
  declaration_date: string
  total_quantity: number
  total_value: number
  total_weight_kg: number | null
  created_at: string
}

export default function DeclaracaoConteudoPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  const { companyId } = useCompanyId()

  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: declarations, isLoading } = useQuery<DeclarationRow[]>({
    queryKey: ['content-declarations', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from('content_declarations') as any)
        .select('id, recipient_name, declaration_city, declaration_date, total_quantity, total_value, total_weight_kg, created_at')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      return (data ?? []) as DeclarationRow[]
    },
  })

  const filtered = (declarations ?? []).filter(d =>
    d.recipient_name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { error } = await (supabase.from('content_declarations') as any).delete().eq('id', deleteId)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['content-declarations', companyId] })
      toast('success', 'Declaração excluída.')
      setDeleteId(null)
    } catch (e: any) {
      toast('error', `Erro ao excluir: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDuplicate(id: string) {
    setBusyId(id)
    try {
      const { data: original, error: fetchErr } = await (supabase.from('content_declarations') as any)
        .select('*').eq('id', id).single()
      if (fetchErr || !original) throw fetchErr ?? new Error('Declaração não encontrada')

      const { data: items, error: itemsErr } = await (supabase.from('content_declaration_items') as any)
        .select('product_id, description, quantity, value, sort_order').eq('declaration_id', id)
      if (itemsErr) throw itemsErr

      const now = new Date()
      const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = original
      const { data: created, error: insErr } = await (supabase.from('content_declarations') as any)
        .insert([{ ...rest, declaration_date: todayISO }]).select('id').single()
      if (insErr || !created) throw insErr ?? new Error('Falha ao duplicar')

      if ((items ?? []).length > 0) {
        const rows = (items ?? []).map((i: any) => ({ ...i, declaration_id: created.id }))
        const { error: itemsInsErr } = await (supabase.from('content_declaration_items') as any).insert(rows)
        if (itemsInsErr) throw itemsInsErr
      }

      await queryClient.invalidateQueries({ queryKey: ['content-declarations', companyId] })
      toast('success', 'Declaração duplicada — data atualizada para hoje.')
    } catch (e: any) {
      toast('error', `Erro ao duplicar: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  async function handlePrint(id: string) {
    setBusyId(id)
    try {
      const { data: d, error } = await (supabase.from('content_declarations') as any).select('*').eq('id', id).single()
      if (error || !d) throw error ?? new Error('Declaração não encontrada')
      const { data: items } = await (supabase.from('content_declaration_items') as any)
        .select('description, quantity, value').eq('declaration_id', id).order('sort_order')

      const doc: DeclarationDocumentData = {
        sender: {
          name: d.sender_name, document: d.sender_document, zipCode: d.sender_zip_code,
          street: d.sender_street, number: d.sender_number, complement: d.sender_complement,
          neighborhood: d.sender_neighborhood, city: d.sender_city, state: d.sender_state,
        },
        recipient: {
          name: d.recipient_name, document: d.recipient_document, zipCode: d.recipient_zip_code,
          street: d.recipient_street, number: d.recipient_number, complement: d.recipient_complement,
          neighborhood: d.recipient_neighborhood, city: d.recipient_city, state: d.recipient_state,
        },
        items: (items ?? []).map((i: any) => ({ description: i.description, quantity: Number(i.quantity), value: Number(i.value) })),
        totalQuantity: Number(d.total_quantity) || 0,
        totalValue: Number(d.total_value) || 0,
        totalWeightKg: d.total_weight_kg != null ? Number(d.total_weight_kg) : null,
        declarationCity: d.declaration_city,
        declarationDate: d.declaration_date,
        notes: d.notes,
      }
      printContentDeclaration(doc)
    } catch (e: any) {
      toast('error', `Erro ao gerar impressão: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page-enter">
      <Header
        title="Declaração de Conteúdo"
        subtitle={`${declarations?.length ?? 0} declaração${declarations?.length !== 1 ? 'ões' : ''} registrada${declarations?.length !== 1 ? 's' : ''}`}
      />

      <div className="p-4 sm:p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar por destinatário..."
              className="input pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Link href="/declaracao-conteudo/nova" className="btn-primary flex items-center justify-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <Plus size={16} /> Nova Declaração
          </Link>
        </div>

        {/* Lista */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileStack}
              title={search ? 'Nenhuma declaração encontrada' : 'Nenhuma declaração cadastrada'}
              description={search ? `Não encontramos resultados para "${search}".` : 'Crie sua primeira Declaração de Conteúdo para um envio.'}
              action={!search ? { label: '+ Nova declaração', onClick: () => router.push('/declaracao-conteudo/nova') } : undefined}
            />
          ) : (
            <>
              {/* MOBILE */}
              <div className="md:hidden divide-y divide-border dark:divide-border-dark">
                {filtered.map(d => (
                  <div key={d.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary dark:text-stone-100 leading-snug break-words">{d.recipient_name}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {format(new Date(d.declaration_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })} · {d.declaration_city}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary flex-shrink-0">{formatCurrency(d.total_value)}</span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-1">{d.total_quantity} itens{d.total_weight_kg != null ? ` · ${Number(d.total_weight_kg).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg` : ''}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Link href={`/declaracao-conteudo/${d.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-border dark:border-border-dark hover:border-primary hover:text-primary transition-colors">
                        <Eye size={12} /> Ver/Editar
                      </Link>
                      <button onClick={() => handlePrint(d.id)} disabled={busyId === d.id} className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors">
                        {busyId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                      </button>
                      <button onClick={() => handleDuplicate(d.id)} disabled={busyId === d.id} className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 transition-colors">
                        <Copy size={14} />
                      </button>
                      <button onClick={() => setDeleteId(d.id)} className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error-light transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border dark:border-border-dark">
                      {['Data', 'Destinatário', 'Itens', 'Peso', 'Valor total', 'Ações'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-text-muted dark:text-stone-400 uppercase tracking-wider px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(d => (
                      <tr key={d.id} className="border-b border-border dark:border-border-dark last:border-0 hover:bg-primary-50/30 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3.5 text-xs text-text-secondary dark:text-stone-300">
                          {format(new Date(d.declaration_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-text-primary dark:text-stone-100">{d.recipient_name}</p>
                          <p className="text-[11px] text-text-muted">{d.declaration_city}</p>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-text-secondary dark:text-stone-300">{d.total_quantity}</td>
                        <td className="px-4 py-3.5 text-xs text-text-secondary dark:text-stone-300">
                          {d.total_weight_kg != null ? `${Number(d.total_weight_kg).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-sm font-bold text-primary">{formatCurrency(d.total_value)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <Link href={`/declaracao-conteudo/${d.id}`} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors" title="Ver/Editar">
                              <Eye size={14} />
                            </Link>
                            <button onClick={() => handlePrint(d.id)} disabled={busyId === d.id} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors" title="Imprimir/PDF">
                              {busyId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                            </button>
                            <button onClick={() => handleDuplicate(d.id)} disabled={busyId === d.id} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors" title="Duplicar">
                              <Copy size={14} />
                            </button>
                            <button onClick={() => setDeleteId(d.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error-light dark:hover:bg-error/10 transition-colors" title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal confirmar exclusão */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-modal w-full max-w-sm animate-scaleIn p-6">
            <div className="w-12 h-12 rounded-2xl bg-error-light dark:bg-error/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-error" />
            </div>
            <h3 className="text-base font-semibold text-text-primary dark:text-stone-100 text-center mb-2">Excluir declaração?</h3>
            <p className="text-sm text-text-secondary dark:text-stone-400 text-center mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-error hover:bg-error-dark active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : null}
                {deleting ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
