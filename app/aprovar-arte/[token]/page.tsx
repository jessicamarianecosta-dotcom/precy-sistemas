'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, AlertCircle, Loader2, Clock, AlertTriangle } from 'lucide-react'

type Artwork = {
  id: string
  number: number
  label: string
  itemName: string | null
  status: 'aguardando_aprovacao' | 'aprovada' | 'alteracao_solicitada'
  version: number
  files: { url: string }[]
  response: { response: string; customer_note: string | null; created_at: string } | null
}
type Data = {
  company: { name?: string; logoUrl?: string | null }
  order: { number?: string; deadline?: string | null }
  customer: { name?: string }
  notes?: string | null
  status: string
  summary: { total: number; aprovadas: number; aguardando: number; alteracaoSolicitada: number }
  artworks: Artwork[]
  instructions: string
  instructionsVersion: string
  consentText: string
}

const STATUS_LABEL: Record<string, string> = { aguardando_aprovacao: 'Aguardando aprovação', aprovada: 'Aprovada', alteracao_solicitada: 'Alteração solicitada' }
const STATUS_COLOR: Record<string, string> = {
  aguardando_aprovacao: 'bg-amber-100 text-amber-700',
  aprovada: 'bg-emerald-100 text-emerald-700',
  alteracao_solicitada: 'bg-red-100 text-red-700',
}

export default function AprovarArtePage() {
  const params = useParams<{ token: string }>()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showInstructions, setShowInstructions] = useState(false)
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [active, setActive] = useState<{ artworkId: string; action: 'approve' | 'request_changes' } | null>(null)
  const [note, setNote] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  function load() {
    fetch('/api/public/aprovacao-arte/' + encodeURIComponent(params.token))
      .then(async r => { const d = await r.json(); if (!r.ok) throw Error(d.error); setData(d); setName(n => n || d.customer?.name || '') })
      .catch(e => setError(e.message || 'Link indisponível'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [params.token])

  async function respond(artworkId: string, action: 'approve' | 'request_changes') {
    if (!consent || sending) return
    if (action === 'request_changes' && !note.trim()) return
    if (action === 'approve' && !window.confirm('Confirmar a aprovação desta arte? Depois de confirmar não será possível enviar outra resposta para ela.')) return
    setSending(true); setFormError('')
    try {
      let attachmentPaths: string[] = []
      if (action === 'request_changes' && attachments.length) {
        const form = new FormData()
        form.append('artworkId', artworkId)
        attachments.forEach(file => form.append('files', file))
        const upload = await fetch('/api/public/aprovacao-arte/' + encodeURIComponent(params.token) + '/anexos', { method: 'POST', body: form })
        const uploaded = await upload.json()
        if (!upload.ok) throw Error(uploaded.error)
        attachmentPaths = uploaded.paths
      }
      const r = await fetch('/api/public/aprovacao-arte/' + encodeURIComponent(params.token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId, action, consent, note, customerName: name, attachmentPaths }),
      })
      const d = await r.json()
      if (!r.ok) throw Error(d.error)
      setActive(null); setNote(''); setAttachments([])
      load()
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Falha ao registrar resposta') }
    finally { setSending(false) }
  }

  if (loading) return <main className="min-h-screen grid place-items-center bg-stone-50"><Loader2 className="animate-spin text-violet-700" /></main>
  if (error && !data) return <main className="min-h-screen grid place-items-center bg-stone-50 p-5"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow"><AlertCircle className="mx-auto mb-3 text-red-500" size={32} /><h1 className="text-xl font-bold">Link indisponível</h1><p className="mt-2 text-sm text-stone-600">{error}</p></div></main>
  if (!data) return null

  const linkClosed = data.status === 'cancelada'
  const allApproved = data.summary.total > 0 && data.summary.aprovadas === data.summary.total

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-7 text-center">
          {data.company.logoUrl && <img src={data.company.logoUrl} alt="" className="mx-auto mb-3 max-h-14 max-w-40 object-contain" />}
          <p className="text-sm font-semibold text-violet-700">{data.company.name}</p>
          <h1 className="mt-2 text-2xl font-bold">Conferência de artes</h1>
          <p className="mt-2 text-sm text-stone-600">Pedido #{data.order.number} · Olá, {data.customer.name || 'tudo bem'}! Confira cada arte abaixo e aprove individualmente.</p>
        </header>

        <section className="mb-5 rounded-2xl border bg-white p-5 shadow-sm">
          {allApproved ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={18} /> Todas as artes foram aprovadas. Obrigado!</div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold">{data.summary.total} {data.summary.total === 1 ? 'arte enviada' : 'artes enviadas'}</span>
              {data.summary.aprovadas > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">{data.summary.aprovadas} aprovada{data.summary.aprovadas > 1 ? 's' : ''}</span>}
              {data.summary.aguardando > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">{data.summary.aguardando} aguardando</span>}
              {data.summary.alteracaoSolicitada > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">{data.summary.alteracaoSolicitada} com alteração solicitada</span>}
            </div>
          )}
          {data.order.deadline && <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500"><Clock size={12} /> Prazo para resposta: {new Date(data.order.deadline).toLocaleDateString('pt-BR')}</p>}
          {data.notes && <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm"><b>Observações:</b> {data.notes}</p>}
        </section>

        {(() => {
          const groups: { itemName: string | null; artworks: Artwork[] }[] = []
          for (const a of data.artworks) {
            const g = groups.find(g => g.itemName === a.itemName)
            if (g) g.artworks.push(a); else groups.push({ itemName: a.itemName, artworks: [a] })
          }
          return groups.map((g, gi) => (
            <section key={gi} className="mb-5">
              {g.itemName && <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-stone-500">{g.itemName}</h2>}
              <div className="space-y-4">
                {g.artworks.map(a => {
                  const isActive = active?.artworkId === a.id
                  return (
                    <article key={a.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                      <div className="flex items-center justify-between gap-2 border-b bg-stone-50 px-4 py-2.5 sm:px-6">
                        <p className="font-semibold">{a.label}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                      </div>
                      <div className="grid gap-0 sm:grid-cols-2">
                        {a.files.map((f, i) => (
                          <button key={i} type="button" onClick={() => setPreview(f.url)} className="relative block w-full bg-stone-100">
                            <img src={f.url} alt={a.label} className="max-h-96 w-full object-contain" />
                            <span className="pointer-events-none absolute inset-0 grid place-items-center text-3xl font-black tracking-widest text-black/10 rotate-[-25deg]">PRÉVIA</span>
                            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">Ampliar</span>
                          </button>
                        ))}
                      </div>
                      <div className="p-4 sm:p-6">
                        {a.response && (
                          <p className="mb-3 text-sm text-stone-600">
                            {a.response.response === 'aprovada' ? 'Você aprovou esta arte' : 'Você solicitou alteração'} em {new Date(a.response.created_at).toLocaleString('pt-BR')}.
                            {a.response.customer_note && <span className="block mt-1 italic">&ldquo;{a.response.customer_note}&rdquo;</span>}
                          </p>
                        )}
                        {a.status === 'aguardando_aprovacao' && !linkClosed && (
                          isActive ? (
                            <div className="space-y-3">
                              {active.action === 'request_changes' && (
                                <>
                                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="w-full rounded-lg border p-3 text-sm" placeholder="Descreva o ajuste desejado..." autoFocus />
                                  <input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e => setAttachments(Array.from(e.target.files ?? []))} className="text-xs" />
                                </>
                              )}
                              {formError && <p className="text-sm text-red-600">{formError}</p>}
                              <div className="flex gap-2">
                                <button disabled={sending || (active.action === 'request_changes' && !note.trim())} onClick={() => respond(a.id, active.action)} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                                  {sending ? 'Enviando...' : active.action === 'approve' ? 'Confirmar aprovação' : 'Enviar solicitação'}
                                </button>
                                <button disabled={sending} onClick={() => { setActive(null); setFormError('') }} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => setActive({ artworkId: a.id, action: 'request_changes' })} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Solicitar alteração nesta arte</button>
                              <button onClick={() => setActive({ artworkId: a.id, action: 'approve' })} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white">Aprovar esta arte</button>
                            </div>
                          )
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))
        })()}

        {!linkClosed && data.artworks.some(a => a.status === 'aguardando_aprovacao') && (
          <section className="mb-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold">Antes de responder</h2>
            <label className="mt-3 block text-sm">Seu nome<input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label className="mt-4 flex items-start gap-3 text-sm leading-5"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-4 w-4" /><span>{data.consentText}</span></label>
            {!consent && <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle size={12} /> Confirme a leitura acima para poder aprovar ou solicitar alteração.</p>}
          </section>
        )}

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
          <button onClick={() => setShowInstructions(v => !v)} className="flex w-full justify-between text-left font-semibold">
            Orientações de acabamento <span className="text-sm font-normal text-violet-700">{showInstructions ? 'Recolher' : 'Ler orientações'}</span>
          </button>
          <div className={showInstructions ? 'mt-4 whitespace-pre-wrap text-sm leading-6 text-stone-700' : 'mt-4 max-h-28 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-stone-700'}>{data.instructions}</div>
          {!showInstructions && <button onClick={() => setShowInstructions(true)} className="mt-2 text-sm text-violet-700">Ver orientações completas</button>}
        </section>
        <p className="mt-6 text-center text-xs text-stone-400">Cada resposta fica vinculada à arte apresentada e registrada no histórico do pedido.</p>
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-h-[90vh] max-w-full object-contain" />
        </div>
      )}
    </main>
  )
}
