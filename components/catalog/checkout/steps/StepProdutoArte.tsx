'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Palette, FileCheck2, Pencil, Info, Minus, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { useToast } from '@/components/ui/Toaster'
import { OBSERVATION_MAX, cleanObservation } from '@/lib/catalog/observation'
import type { CartItem } from '@/lib/catalog/useCart'
import { EMPTY_ITEM_ART, type ItemArtState, type ArtOrigin } from '@/lib/catalog/checkout/useCheckoutState'
import { MultiFileUpload } from '@/components/catalog/checkout/MultiFileUpload'

const FILE_ACCEPT = 'image/*,application/pdf,.ai,.eps,.cdr,.zip,.rar'

function itemKeyOf(item: CartItem) {
  return `${item.productId}:${item.variantId ?? ''}`
}

function isItemArtComplete(art: ItemArtState | undefined): boolean {
  if (!art?.origin) return false
  if (art.origin === 'own') return art.ownFiles.length > 0
  return art.brief.description.trim().length > 0
}

interface ItemArtCardProps {
  slug: string
  item: CartItem
  art: ItemArtState
  onChange: (patch: Partial<ItemArtState>) => void
  onChangeBrief: (patch: Partial<ItemArtState['brief']>) => void
  onUpdateQty: (productId: string, variantId: string | null | undefined, quantity: number) => void
  onUpdateNotes: (productId: string, variantId: string | null | undefined, notes: string | null) => void
  onRemoveItem: (productId: string, variantId?: string | null) => void
}

function ItemArtCard({ slug, item, art, onChange, onChangeBrief, onUpdateQty, onUpdateNotes, onRemoveItem }: ItemArtCardProps) {
  const complete = isItemArtComplete(art)
  const [editing, setEditing] = useState(!complete)
  const [editingNotes, setEditingNotes] = useState(false)

  function chooseOrigin(origin: ArtOrigin) {
    onChange({ origin })
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-lg bg-surface dark:bg-white/5 overflow-hidden flex-shrink-0">
          {item.photo && <Image src={item.photo} alt="" fill sizes="48px" className="object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--store-text)' }}>{item.name}</p>
          {item.variantLabel && <p className="text-[11px] truncate" style={{ color: 'var(--store-text-secondary)' }}>{item.variantLabel}</p>}
          {!editingNotes && item.notes && <p className="text-[11px] line-clamp-1" style={{ color: 'var(--store-text-secondary)' }}>Obs.: {item.notes}</p>}
          <p className="text-xs" style={{ color: 'var(--store-text-secondary)' }}>{formatCurrency(item.price)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onUpdateQty(item.productId, item.variantId, item.quantity - 1)} className="p-1 rounded hover:bg-[var(--store-surface)]"><Minus size={13} /></button>
          <span className="text-sm w-5 text-center" style={{ color: 'var(--store-text)' }}>{item.quantity}</span>
          <button type="button" onClick={() => onUpdateQty(item.productId, item.variantId, item.quantity + 1)} className="p-1 rounded hover:bg-[var(--store-surface)]"><Plus size={13} /></button>
        </div>
        <button type="button" onClick={() => setEditingNotes(v => !v)} title="Editar observação" className="p-1.5 hover:opacity-70" style={{ color: 'var(--store-text-secondary)' }}>
          <Pencil size={14} />
        </button>
        <button type="button" onClick={() => onRemoveItem(item.productId, item.variantId)} className="p-1.5 hover:opacity-70 text-error">
          <Trash2 size={14} />
        </button>
      </div>
      {editingNotes && (
        <textarea
          autoFocus
          className="input text-xs"
          rows={2}
          maxLength={OBSERVATION_MAX}
          placeholder="Observação sobre este produto..."
          defaultValue={item.notes ?? ''}
          onBlur={e => { onUpdateNotes(item.productId, item.variantId, cleanObservation(e.target.value)); setEditingNotes(false) }}
        />
      )}

      {!editing && complete ? (
        <div className="rounded-lg p-3 space-y-1.5 text-xs" style={{ backgroundColor: 'var(--store-surface)' }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--store-text)' }}>
              <FileCheck2 size={13} />
              {art.origin === 'own' ? 'Já tenho minha arte' : 'Criação pela LumiLife'}
            </span>
            <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--store-primary)' }}>
              <Pencil size={12} /> Editar
            </button>
          </div>
          {art.origin === 'own' ? (
            <p style={{ color: 'var(--store-text-secondary)' }}>{art.ownFiles.length} arquivo(s) enviado(s)</p>
          ) : (
            <div style={{ color: 'var(--store-text-secondary)' }} className="space-y-0.5">
              {art.brief.text && <p>Texto/nome: {art.brief.text}</p>}
              {art.brief.colors && <p>Cores: {art.brief.colors}</p>}
              {art.brief.style && <p>Estilo: {art.brief.style}</p>}
              <p className="line-clamp-2">Descrição: {art.brief.description}</p>
              {art.referenceFiles.length > 0 && <p>{art.referenceFiles.length} referência(s) enviada(s)</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => chooseOrigin('own')}
              className="text-left p-3 rounded-lg border text-sm transition-colors"
              style={art.origin === 'own'
                ? { borderColor: 'var(--store-primary)', backgroundColor: 'var(--store-surface)' }
                : { borderColor: 'var(--store-border)' }}
            >
              <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--store-text)' }}>
                <FileCheck2 size={14} /> Já tenho minha arte
              </span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--store-text-secondary)' }}>
                Pronta para enviar para produção.
              </span>
            </button>
            <button
              type="button"
              onClick={() => chooseOrigin('lumilife')}
              className="text-left p-3 rounded-lg border text-sm transition-colors"
              style={art.origin === 'lumilife'
                ? { borderColor: 'var(--store-primary)', backgroundColor: 'var(--store-surface)' }
                : { borderColor: 'var(--store-border)' }}
            >
              <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--store-text)' }}>
                <Palette size={14} /> Quero que a LumiLife crie
              </span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--store-text-secondary)' }}>
                Não tem sua arte pronta? Nossa equipe cria para você!
              </span>
            </button>
          </div>

          {art.origin === 'own' && (
            <MultiFileUpload
              slug={slug}
              files={art.ownFiles}
              onChange={ownFiles => onChange({ ownFiles })}
              label={art.ownFiles.length > 0 ? 'Adicionar outro arquivo' : 'Enviar arquivo(s) da arte'}
              accept={FILE_ACCEPT}
            />
          )}

          {art.origin === 'lumilife' && (
            <div className="space-y-2.5">
              <div className="flex items-start gap-2 text-xs p-2.5 rounded-lg" style={{ backgroundColor: 'var(--store-surface)', color: 'var(--store-text-secondary)' }}>
                <Info size={14} className="shrink-0 mt-0.5" />
                <span>
                  Você recebe <strong>3 propostas de modelo sem custo</strong>. Depois de escolher uma delas, tem direito a
                  até <strong>3 alterações gratuitas na proposta escolhida</strong> (não são 3 alterações em cada uma das propostas).
                  Alterações além dessas só são feitas mediante orçamento e sua autorização.
                </span>
              </div>
              <input
                className="input"
                placeholder="Qual texto ou nome deve aparecer na arte?"
                value={art.brief.text}
                onChange={e => onChangeBrief({ text: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input"
                  placeholder="Quais cores deseja utilizar?"
                  value={art.brief.colors}
                  onChange={e => onChangeBrief({ colors: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Qual estilo de arte prefere?"
                  value={art.brief.style}
                  onChange={e => onChangeBrief({ style: e.target.value })}
                />
              </div>
              <textarea
                className="input"
                rows={3}
                placeholder="Conte como você gostaria que sua arte fosse criada"
                value={art.brief.description}
                onChange={e => onChangeBrief({ description: e.target.value })}
              />
              <MultiFileUpload
                slug={slug}
                files={art.referenceFiles}
                onChange={referenceFiles => onChange({ referenceFiles })}
                label="Enviar referência visual (opcional)"
                accept={FILE_ACCEPT}
              />
            </div>
          )}

          {complete && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-medium hover:opacity-70"
              style={{ color: 'var(--store-primary)' }}
            >
              Concluir esta arte
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface StepProdutoArteProps {
  slug: string
  items: CartItem[]
  itemsArt: Record<string, ItemArtState>
  onChangeItemArt: (itemKey: string, patch: Partial<ItemArtState>) => void
  onChangeItemArtBrief: (itemKey: string, patch: Partial<ItemArtState['brief']>) => void
  onUpdateQty: (productId: string, variantId: string | null | undefined, quantity: number) => void
  onUpdateNotes: (productId: string, variantId: string | null | undefined, notes: string | null) => void
  onRemoveItem: (productId: string, variantId?: string | null) => void
  onNext: () => void
}

/**
 * Etapa 2 — Produto e informações da arte. Cada item do carrinho tem seu
 * próprio formulário de arte, totalmente isolado dos demais (arquivos,
 * textos e solicitações nunca se misturam entre produtos diferentes).
 */
export function StepProdutoArte({ slug, items, itemsArt, onChangeItemArt, onChangeItemArtBrief, onUpdateQty, onUpdateNotes, onRemoveItem, onNext }: StepProdutoArteProps) {
  const { toast } = useToast()

  function handleNext() {
    const missing = items.find(item => !isItemArtComplete(itemsArt[itemKeyOf(item)]))
    if (missing) {
      toast('error', `Finalize a arte de "${missing.name}" antes de continuar`)
      return
    }
    onNext()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map(item => {
          const key = itemKeyOf(item)
          const art = itemsArt[key] ?? EMPTY_ITEM_ART
          return (
            <ItemArtCard
              key={key}
              slug={slug}
              item={item}
              art={art}
              onChange={patch => onChangeItemArt(key, patch)}
              onChangeBrief={patch => onChangeItemArtBrief(key, patch)}
              onUpdateQty={onUpdateQty}
              onUpdateNotes={onUpdateNotes}
              onRemoveItem={onRemoveItem}
            />
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleNext}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
      >
        Continuar
      </button>
    </div>
  )
}
