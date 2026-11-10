'use client'

import { useCallback, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Star, Trash2, RefreshCw, Plus, AlertCircle, Play, Film } from 'lucide-react'
import { clsx } from 'clsx'
import { uploadFileXhr } from '@/lib/catalog/useImageUploadXhr'
import { compressImage } from '@/lib/catalog/useImageCompression'

interface ProductMedia {
  id: string
  url: string
  sort_order: number
  media_type: 'image' | 'video'
  is_primary: boolean
  storage_path: string | null
  duration_seconds: number | null
}

interface Props {
  productId: string
  companyId: string
}

const MAX_PHOTOS = 20
const MAX_VIDEO_SECONDS = 20
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4']

/** Lê a duração real do vídeo no navegador antes de enviar (bytes não mentem como a extensão, mas aqui é só UX — o servidor não reconfirma a duração, ver nota em app/api/catalogo/upload/route.ts). */
function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration) }
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler o vídeo.')) }
    video.src = url
  })
}

async function deleteStorageFile(path: string | null) {
  if (!path) return
  try {
    await fetch('/api/catalogo/upload', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
  } catch { /* best-effort — a linha do banco já foi removida, que é o que importa */ }
}

/**
 * Galeria de mídia de um produto (product_images): até 20 fotos + 1 vídeo
 * de até 20s. A primeira foto marcada como `is_primary` é a capa do
 * catálogo/miniatura/carrinho/página do produto. Suporta arrastar para
 * reordenar as fotos, remover, substituir e definir a capa. O vídeo é um
 * slot único e separado, nunca entra na ordenação/é capa.
 */
export function ProductGalleryUpload({ productId, companyId }: Props) {
  const supabase = createClient()
  const qc = useQueryClient()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetId = useRef<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverGrid, setDragOverGrid] = useState(false)
  const [batch, setBatch] = useState<{ index: number; total: number } | null>(null)

  const { data: media } = useQuery<ProductMedia[]>({
    queryKey: ['product-images', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await (supabase.from('product_images') as any)
        .select('id, url, sort_order, media_type, is_primary, storage_path, duration_seconds')
        .eq('product_id', productId)
        // Imagens enviadas especificamente para uma opção de variação (ex:
        // cada capa de um grupo "Capa") não contam como foto geral do
        // produto — ficam fora desta galeria (migration 096).
        .or('gallery_visible.eq.true,media_type.eq.video')
        .order('sort_order')
      return data ?? []
    },
  })

  const photos = (media ?? []).filter(m => m.media_type !== 'video')
  const video = (media ?? []).find(m => m.media_type === 'video') ?? null

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['product-images', productId] })
  }

  const addPhotoMutation = useMutation({
    // sortOrder/isPrimary vêm explícitos de quem chama (em vez de calculados
    // aqui a partir de `photos`) porque, num envio em lote, vários uploads
    // rodam em sequência antes do cache de `product-images` ser invalidado e
    // recarregado — calcular a partir de `photos.length` em cada um deles
    // repetiria sempre o mesmo sort_order/is_primary (valor "congelado" do
    // início do lote), em vez de um valor por arquivo.
    mutationFn: async ({ file, sortOrder, isPrimary }: { file: File; sortOrder: number; isPrimary: boolean }) => {
      const compressed = await compressImage(file)
      const uploaded = await uploadFileXhr(compressed, { productId, mediaType: 'image' }, setProgress)
      const { error } = await (supabase.from('product_images') as any)
        .insert({
          product_id: productId, company_id: companyId, url: uploaded.url, sort_order: sortOrder,
          media_type: 'image', is_primary: isPrimary,
          storage_path: uploaded.path, mime_type: uploaded.mimeType, file_size: uploaded.fileSize,
        })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setProgress(null); setError(null) },
    onError: (err: Error) => { setProgress(null); setError(err.message) },
  })

  const replacePhotoMutation = useMutation({
    mutationFn: async ({ id, file, oldPath }: { id: string; file: File; oldPath: string | null }) => {
      const compressed = await compressImage(file)
      const uploaded = await uploadFileXhr(compressed, { productId, mediaType: 'image' }, setProgress)
      const { error } = await (supabase.from('product_images') as any)
        .update({ url: uploaded.url, storage_path: uploaded.path, mime_type: uploaded.mimeType, file_size: uploaded.fileSize })
        .eq('id', id)
      if (error) throw error
      await deleteStorageFile(oldPath)
    },
    onSuccess: () => { invalidate(); setProgress(null); setError(null) },
    onError: (err: Error) => { setProgress(null); setError(err.message) },
  })

  const removePhotoMutation = useMutation({
    mutationFn: async (img: ProductMedia) => {
      const { error } = await (supabase.from('product_images') as any).delete().eq('id', img.id)
      if (error) throw error
      await deleteStorageFile(img.storage_path)
      // Se a foto removida era a capa, promove a próxima a principal.
      if (img.is_primary) {
        const next = photos.find(p => p.id !== img.id)
        if (next) await (supabase.from('product_images') as any).update({ is_primary: true }).eq('id', next.id)
      }
    },
    onSuccess: invalidate,
  })

  const reorderMutation = useMutation({
    // `is_primary` sempre acompanha quem fica na posição 0 — a primeira foto
    // da galeria É a capa, sem exigir um passo manual extra (trigger
    // enforce_single_primary_product_image, migration 086, desmarca a capa
    // anterior quando a nova é marcada).
    mutationFn: async (updates: { id: string; sort_order: number; is_primary?: true }[]) => {
      await Promise.all(updates.map(u =>
        (supabase.from('product_images') as any)
          .update(u.is_primary ? { sort_order: u.sort_order, is_primary: true } : { sort_order: u.sort_order })
          .eq('id', u.id)
      ))
    },
    onSuccess: invalidate,
  })

  const setPrimaryMutation = useMutation({
    mutationFn: async (img: ProductMedia) => {
      const { error } = await (supabase.from('product_images') as any).update({ is_primary: true }).eq('id', img.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const addVideoMutation = useMutation({
    mutationFn: async (file: File) => {
      const duration = await readVideoDuration(file)
      if (duration > MAX_VIDEO_SECONDS + 0.5) {
        throw new Error(`O vídeo tem ${duration.toFixed(0)}s — o máximo permitido é ${MAX_VIDEO_SECONDS}s.`)
      }
      const uploaded = await uploadFileXhr(file, { productId, mediaType: 'video', duration }, setProgress)
      const { error } = await (supabase.from('product_images') as any)
        .insert({
          product_id: productId, company_id: companyId, url: uploaded.url, sort_order: 0,
          media_type: 'video', is_primary: false,
          storage_path: uploaded.path, mime_type: uploaded.mimeType, file_size: uploaded.fileSize,
          duration_seconds: Math.round(duration * 100) / 100,
        })
      if (error) throw error
    },
    onSuccess: () => { invalidate(); setProgress(null); setError(null) },
    onError: (err: Error) => { setProgress(null); setError(err.message) },
  })

  const replaceVideoMutation = useMutation({
    mutationFn: async ({ file, oldPath, oldId }: { file: File; oldPath: string | null; oldId: string }) => {
      const duration = await readVideoDuration(file)
      if (duration > MAX_VIDEO_SECONDS + 0.5) {
        throw new Error(`O vídeo tem ${duration.toFixed(0)}s — o máximo permitido é ${MAX_VIDEO_SECONDS}s.`)
      }
      const uploaded = await uploadFileXhr(file, { productId, mediaType: 'video', duration }, setProgress)
      const { error } = await (supabase.from('product_images') as any)
        .update({
          url: uploaded.url, storage_path: uploaded.path, mime_type: uploaded.mimeType,
          file_size: uploaded.fileSize, duration_seconds: Math.round(duration * 100) / 100,
        })
        .eq('id', oldId)
      if (error) throw error
      await deleteStorageFile(oldPath)
    },
    onSuccess: () => { invalidate(); setProgress(null); setError(null) },
    onError: (err: Error) => { setProgress(null); setError(err.message) },
  })

  const removeVideoMutation = useMutation({
    mutationFn: async (v: ProductMedia) => {
      const { error } = await (supabase.from('product_images') as any).delete().eq('id', v.id)
      if (error) throw error
      await deleteStorageFile(v.storage_path)
    },
    onSuccess: invalidate,
  })

  const handlePickPhoto = useCallback((file: File) => {
    setError(null)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Formato não permitido. Use JPG, PNG ou WEBP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 10MB.')
      return
    }
    if (replaceTargetId.current) {
      const target = photos.find(p => p.id === replaceTargetId.current)
      replacePhotoMutation.mutate({ id: replaceTargetId.current, file, oldPath: target?.storage_path ?? null })
      replaceTargetId.current = null
    } else {
      if (photos.length >= MAX_PHOTOS) { setError(`Limite de ${MAX_PHOTOS} fotos atingido.`); return }
      addPhotoMutation.mutate({
        file,
        sortOrder: photos.length > 0 ? Math.max(...photos.map(i => i.sort_order)) + 1 : 0,
        isPrimary: photos.length === 0,
      })
    }
  }, [addPhotoMutation, replacePhotoMutation, photos])

  /**
   * Upload de várias fotos de uma vez (seleção múltipla no picker ou
   * arrastar-e-soltar vários arquivos juntos). Sempre adiciona (nunca troca
   * uma foto existente) e respeita o limite de MAX_PHOTOS — o que não
   * couber fica de fora, com aviso, em vez de travar ou sobrescrever.
   */
  const handleFilesBatch = useCallback(async (fileList: FileList | File[]) => {
    setError(null)
    const files = Array.from(fileList)
    const invalid = files.filter(f => !ALLOWED_IMAGE_TYPES.includes(f.type) || f.size > 10 * 1024 * 1024)
    const valid = files.filter(f => ALLOWED_IMAGE_TYPES.includes(f.type) && f.size <= 10 * 1024 * 1024)

    const availableSlots = Math.max(0, MAX_PHOTOS - photos.length)
    const toUpload = valid.slice(0, availableSlots)
    const skipped = valid.length - toUpload.length

    if (toUpload.length === 0) {
      setError(
        invalid.length > 0
          ? 'Nenhuma imagem válida — use JPG, PNG ou WEBP, até 10MB cada.'
          : `Limite de ${MAX_PHOTOS} fotos atingido.`
      )
      return
    }

    const baseOrder = photos.length > 0 ? Math.max(...photos.map(i => i.sort_order)) + 1 : 0
    const wasEmpty = photos.length === 0

    setBatch({ index: 0, total: toUpload.length })
    for (let i = 0; i < toUpload.length; i++) {
      setBatch({ index: i + 1, total: toUpload.length })
      try {
        await addPhotoMutation.mutateAsync({ file: toUpload[i], sortOrder: baseOrder + i, isPrimary: wasEmpty && i === 0 })
      } catch {
        // addPhotoMutation.onError já registrou a mensagem — segue para o
        // próximo arquivo do lote em vez de abortar os demais.
      }
    }
    setBatch(null)

    if (invalid.length > 0 || skipped > 0) {
      const parts = []
      if (invalid.length > 0) parts.push(`${invalid.length} arquivo(s) em formato/tamanho inválido`)
      if (skipped > 0) parts.push(`${skipped} imagem(ns) além do limite de ${MAX_PHOTOS}`)
      setError(`${parts.join(' · ')} não foram enviados.`)
    }
  }, [addPhotoMutation, photos])

  function handleGridDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOverGrid(false)
    if (!e.dataTransfer.types.includes('Files')) return // reordenação interna, não um arquivo do sistema
    if (e.dataTransfer.files.length > 0) handleFilesBatch(e.dataTransfer.files)
  }

  function handleGridDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setDragOverGrid(true)
  }

  const handlePickVideo = useCallback((file: File) => {
    setError(null)
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setError('Formato de vídeo não permitido. Use MP4 (H.264).')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Vídeo muito grande. Máximo 25MB.')
      return
    }
    if (video) {
      replaceVideoMutation.mutate({ file, oldPath: video.storage_path, oldId: video.id })
    } else {
      addVideoMutation.mutate(file)
    }
  }, [video, addVideoMutation, replaceVideoMutation])

  function onDrop(targetIdx: number) {
    if (dragIndex === null || dragIndex === targetIdx) { setDragIndex(null); return }
    const reordered = [...photos]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIdx, 0, moved)
    reorderMutation.mutate(reordered.map((img, idx) => (
      idx === 0 ? { id: img.id, sort_order: idx, is_primary: true } : { id: img.id, sort_order: idx }
    )))
    setDragIndex(null)
  }

  const photoBusy = addPhotoMutation.isPending || replacePhotoMutation.isPending
  const videoBusy = addVideoMutation.isPending || replaceVideoMutation.isPending

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-text-primary dark:text-stone-100">Fotos</p>
          <span className="text-[11px] text-text-muted">{photos.length} de {MAX_PHOTOS} fotos</span>
        </div>
        <div
          onDragOver={handleGridDragOver}
          onDragLeave={e => { if (!e.dataTransfer.types.includes('Files')) return; setDragOverGrid(false) }}
          onDrop={handleGridDrop}
          className={clsx(
            'grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl transition-colors',
            dragOverGrid && 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-surface-dark'
          )}
        >
          {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
            const img = photos[idx]
            if (!img) {
              const isNextEmpty = idx === photos.length
              return (
                <button
                  key={`empty-${idx}`}
                  type="button"
                  disabled={!isNextEmpty || photoBusy}
                  onClick={() => { replaceTargetId.current = null; photoInputRef.current?.click() }}
                  className={clsx(
                    'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-text-muted transition-colors',
                    isNextEmpty
                      ? 'border-border dark:border-border-dark hover:border-primary hover:text-primary cursor-pointer'
                      : 'border-transparent opacity-0 pointer-events-none'
                  )}
                >
                  {isNextEmpty && (
                    batch ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-[10px] font-medium">{batch.index}/{batch.total}</span>
                      </>
                    ) : photoBusy ? <Loader2 size={18} className="animate-spin" /> : (
                      <>
                        <Plus size={18} />
                        <span className="text-[10px] font-medium text-center px-1">Adicionar ou arrastar</span>
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
                <img src={img.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                {img.is_primary && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-primary text-white">
                    Capa
                  </span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                  {!img.is_primary && (
                    <button type="button" title="Definir como principal" onClick={() => setPrimaryMutation.mutate(img)}
                      className="p-1.5 rounded-lg bg-white/90 text-text-primary hover:bg-white">
                      <Star size={13} />
                    </button>
                  )}
                  <button type="button" title="Substituir" onClick={() => { replaceTargetId.current = img.id; photoInputRef.current?.click() }}
                    className="p-1.5 rounded-lg bg-white/90 text-text-primary hover:bg-white">
                    <RefreshCw size={13} />
                  </button>
                  <button type="button" title="Remover" onClick={() => removePhotoMutation.mutate(img)}
                    className="p-1.5 rounded-lg bg-white/90 text-error hover:bg-white">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => {
            const fileList = e.target.files
            if (!fileList || fileList.length === 0) { e.target.value = ''; return }
            // Substituir uma foto específica sempre usa só o primeiro arquivo
            // escolhido, mesmo que o seletor do sistema permita mais de um.
            if (replaceTargetId.current || fileList.length === 1) handlePickPhoto(fileList[0])
            else handleFilesBatch(fileList)
            e.target.value = ''
          }}
        />

        <p className="text-[11px] text-text-muted dark:text-stone-500 mt-2">
          Até {MAX_PHOTOS} fotos · JPG, PNG ou WEBP · Máximo 10MB cada · arraste uma ou várias de uma vez. A foto marcada como capa é a
          miniatura do catálogo, do carrinho e a imagem principal da página do produto.
        </p>
      </div>

      <div className="border-t border-border dark:border-border-dark pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-text-primary dark:text-stone-100">Vídeo (opcional)</p>
          <span className="text-[11px] text-text-muted">{video ? '1 de 1' : '0 de 1'}</span>
        </div>

        {!video ? (
          <button
            type="button"
            disabled={videoBusy}
            onClick={() => videoInputRef.current?.click()}
            className="w-full aspect-video max-w-xs rounded-xl border-2 border-dashed border-border dark:border-border-dark flex flex-col items-center justify-center gap-1.5 text-text-muted hover:border-primary hover:text-primary transition-colors"
          >
            {videoBusy ? <Loader2 size={20} className="animate-spin" /> : (
              <>
                <Film size={20} />
                <span className="text-[11px] font-medium">Enviar vídeo (até {MAX_VIDEO_SECONDS}s)</span>
              </>
            )}
          </button>
        ) : (
          <div className="relative w-full max-w-xs aspect-video rounded-xl overflow-hidden group border border-border dark:border-border-dark bg-black">
            <video src={video.url} className="w-full h-full object-cover" muted preload="metadata" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play size={28} className="text-white drop-shadow" fill="white" />
            </div>
            {video.duration_seconds != null && (
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/70 text-white">
                {video.duration_seconds.toFixed(0)}s
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              {videoBusy ? <Loader2 size={18} className="animate-spin text-white" /> : (
                <>
                  <button type="button" title="Substituir vídeo" onClick={() => videoInputRef.current?.click()}
                    className="p-1.5 rounded-lg bg-white/90 text-text-primary hover:bg-white">
                    <RefreshCw size={13} />
                  </button>
                  <button type="button" title="Remover vídeo" onClick={() => removeVideoMutation.mutate(video)}
                    className="p-1.5 rounded-lg bg-white/90 text-error hover:bg-white">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePickVideo(f); e.target.value = '' }}
        />

        <p className="text-[11px] text-text-muted dark:text-stone-500 mt-2">
          1 vídeo · MP4 (H.264) · Máximo 20 segundos e 25MB.
        </p>
      </div>

      {progress !== null && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 size={12} className="animate-spin" />
          {batch ? `Enviando foto ${batch.index} de ${batch.total}... ${progress}%` : `Enviando... ${progress}%`}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1 text-[11px] text-error dark:text-red-400">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  )
}
