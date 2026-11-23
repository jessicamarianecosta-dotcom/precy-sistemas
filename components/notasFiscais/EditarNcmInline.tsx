'use client'

/**
 * Campo inline para preencher/corrigir o NCM de um produto direto na
 * tela de nota fiscal (por pedido), sem precisar ir em Produtos nem no
 * Bling. Salva em `products.ncm` — mesma tabela/coluna que
 * `getMissingFields`/`buildNfePayload` (lib/notasFiscais/fieldMapping.ts)
 * já leem; nenhuma lógica de integração é tocada aqui.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { Check, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

export function EditarNcmInline({
  productId,
  initialValue,
  onSaved,
}: {
  productId: string
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
      if (!ncm) throw new Error('Informe o NCM do produto.')
      const { error } = await (supabase.from('products') as any)
        .update({ ncm, updated_at: new Date().toISOString() })
        .eq('id', productId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast('success', 'NCM salvo no cadastro do produto.')
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
          title="Salvar NCM no cadastro do produto"
          className="p-1 rounded-md bg-primary text-white hover:bg-primary-dark disabled:opacity-50 flex-shrink-0"
        >
          {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        </button>
      )}
    </div>
  )
}
