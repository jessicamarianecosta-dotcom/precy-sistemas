'use client'

/**
 * Campo inline para preencher/corrigir o NCM de um item da nota direto
 * na tela de nota fiscal (por pedido), sem precisar ir em Produtos nem
 * no Bling. Quando o item tem produto vinculado no catálogo, salva em
 * `products.ncm` (fica valendo pra próximas notas desse produto também);
 * quando o item do pedido é avulso (sem produto — `product_id` null,
 * comum em pedidos de arte/estampa personalizada), salva em
 * `order_items.ncm`, único lugar onde esse item tem onde guardar NCM.
 * `lib/notasFiscais/fieldMapping.ts` não muda — as rotas de preview/criar
 * já resolvem product_ncm como `product?.ncm ?? order_item.ncm`.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { Check, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

export function EditarNcmInline({
  productId,
  orderItemId,
  initialValue,
  onSaved,
}: {
  /** id do produto no catálogo — quando presente, salva em products.ncm. */
  productId?: string | null
  /** id do item do pedido — usado como fallback quando productId é null. */
  orderItemId?: string | null
  initialValue: string | null
  onSaved: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [value, setValue] = useState(initialValue ?? '')
  const dirty = value.trim() !== (initialValue ?? '').trim()

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ncm = value.replace(/\D/g, '').trim()
      if (!ncm) throw new Error('Informe o NCM do item.')
      if (productId) {
        const { error } = await (supabase.from('products') as any)
          .update({ ncm, updated_at: new Date().toISOString() })
          .eq('id', productId)
        if (error) throw new Error(error.message)
      } else if (orderItemId) {
        const { error } = await (supabase.from('order_items') as any)
          .update({ ncm, updated_at: new Date().toISOString() })
          .eq('id', orderItemId)
        if (error) throw new Error(error.message)
      } else {
        throw new Error('Não foi possível identificar o item para salvar o NCM.')
      }
    },
    onSuccess: () => {
      toast('success', productId ? 'NCM salvo no cadastro do produto.' : 'NCM salvo neste item do pedido.')
      onSaved()
    },
    onError: (err: Error) => toast('error', err.message),
  })

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="numeric"
        placeholder="NCM (8 dígitos)"
        value={value}
        onChange={e => setValue(e.target.value)}
        className={clsx(
          'input h-7 w-28 text-xs px-2 py-0',
          !value.trim() && 'border-amber-500/60'
        )}
      />
      {dirty && (
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          title={productId ? 'Salvar NCM no cadastro do produto' : 'Salvar NCM neste item do pedido'}
          className="p-1 rounded-md bg-primary text-white hover:bg-primary-dark disabled:opacity-50 flex-shrink-0"
        >
          {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        </button>
      )}
    </div>
  )
}
