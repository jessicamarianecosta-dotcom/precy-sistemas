'use client'

import { useCallback, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Star, Trash2, RefreshCw, Plus, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { uploadImageXhr } from '@/lib/catalog/useImageUploadXhr'
import { compressImage } from '@/lib/catalog/useImageCompression'

interface ProductImage { id: string; url: string; sort_order: number }

interface Props {
  productId: string
  companyId: string
}

const MAX_PHOTOS = 4
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Galeria de até 4 fotos de um produto (product_images). A primeira foto
 * (sort_order 0) é a capa do catálogo/miniatura/carrinho/página do produto.
 * Suporta arrastar para reordenar, remover, substituir e definir como capa.
 */
export function ProductGalleryUpload({ productId, companyId }: Props) {
  const supabase = createClient()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceTargetId = useRef<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const { data: images } = useQuery<ProductImage[]>({
    queryKey: ['product-images', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await (supabase.from('product_images') as any)
        .select('id, url, sort_order').eq('product_id', productId).order('sort_order')
      return data ?? []
    },
  })

  const list = images ?? []

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['product-images', productId] })
  }

  const addMutation = useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressImage(file)
      const url = await uploadImageXhr(compressed, { context: 'product', productId }, setProgress)
      const nextOrder = list.length > 0 ? Math.max(...list.map(i => i.sort_order)) + 1 : 0
      const { error } = await (supabase.from('product_images') as any)
        .insert({ product_id: productId, company_id: companyId, url, sort_order: nextOrder })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setProgress(null); setError(null) },
    onError: (err: Error) => { setProgress(null); setError(err.message) },
  })

  const replaceMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const compressed = await compressImage(file)
      const url = await uploadImageXhr(compressed, { context: 'product', productId }, setProgress)
      const { error } = await (supabase.from('product_images') as any).update({ url }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setProgress(null); setError(null) },
    onError: (err: Error) => { setProgress(null); setError(err.message) },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('product_images') as any).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      await Promise.all(updates.map(u =>
        (supabase.from('product_images') as any).update({ sort_order: u.sort_order }).eq('id', u.id)
      ))
    },
    onSuccess: invalidate,
  })

  const handlePick = useCallback((file: File) => {
    setError(null)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Formato não permitido. Use JPG, PNG ou WEBP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 10MB.')
      return
    }
    if (replaceTargetId.current) {
      replaceMutation.mutate({ id: replaceTargetId.current, file })
      replaceTargetId.current = null
    } else {
      addMutation.mutate(file)
    }
  }, [addMutation, replaceMutation])

  function setPrimary(img: ProductImage) {
    const cover = list.find(i => i.sort_order === 0)
    if (!cover || cover.id === img.id) return
    reorderMutation.mutate([
      { id: img.id, sort_order: 0 },
      { id: cover.id, sort_order: img.sort_order },
    ])
  }

  function onDrop(targetIdx: number) {
    if (dragIndex === null || dragIndex === targetIdx) { setDragIndex(null); return }
    const reordered = [...list]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIdx, 0, moved)
    reorderMutation.mutate(reordered.map((img, idx) => ({ id: img.id, sort_order: idx })))
    setDragIndex(null)
  }

  const busy = addMutation.isPending || replaceMutation.isPending

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
          const img = list[idx]
          if (!img) {
            const isNextEmpty = idx === list.length
            return (
              <button
                key={`empty-${idx}`}
                type="button"
                disabled={!isNextEmpty || busy}
                onClick={() => { replaceTargetId.current = null; inputRef.current?.click() }}
                className={clsx(
                  'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-text-muted transition-colors',
                  isNextEmpty
                    ? 'border-border dark:border-border-dark hover:border-primary hover:text-primary cursor-pointer'
                    : 'border-transparent opacity-0 pointer-events-none'
                )}
              >
                {isNextEmpty && (
                  busy ? <Loader2 size={18} className="animate-spin" /> : (
                    <>
                      <Plus size={18} />
                      <span className="text-[10px] font-medium">Adicionar</span>
                    </>
                  )
                )}
              </button>
            )
          }
          return (
            <div
              key={img.id}
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(idx)}
              className="relative aspect-square rounded-xl overflow-hidden group border border-border dark:border-border-dark bg-surface dark:bg-white/[0.03] cursor-grab active:cursor-grabbing"
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              {img.sort_order === 0 && (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-primary text-white">
                  Capa
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                {img.sort_order !== 0 && (
                  <button type="button" title="Definir como principal" onClick={() => setPrimary(img)}
                    className="p-1.5 rounded-lg bg-white/90 text-text-primary hover:bg-white">
                    <Star size={13} />
                  </button>
                )}
                <button type="button" title="Substituir" onClick={() => { replaceTargetId.current = img.id; inputRef.current?.click() }}
                  className="p-1.5 rounded-lg bg-white/90 text-text-primary hover:bg-white">
                  <RefreshCw size={13} />
                </button>
                <button type="button" title="Remover" onClick={() => removeMutation.mutate(img.id)}
                  className="p-1.5 rounded-lg bg-white/90 text-error hover:bg-white">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handlePick(f); e.target.value = '' }}
      />

      {progress !== null && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 size={12} className="animate-spin" /> Enviando... {progress}%
        </div>
      )}

      <p className="text-[11px] text-text-muted dark:text-stone-500">
        Até 4 fotos · JPG, PNG ou WEBP · Máximo 10MB cada. A primeira foto é a capa do catálogo, a
        miniatura, a imagem do carrinho e da página do produto.
      </p>

      {error && (
        <p className="flex items-center gap-1 text-[11px] text-error dark:text-red-400">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  )
}
